#include "crow.h"
#include <sqlite3.h>
#include <nlohmann/json.hpp>
#include <thread>
#include <mutex>
#include <queue>
#include <condition_variable>
#include <unordered_map>
#include <jwt-cpp/jwt.h>  // For JWT token handling

using json = nlohmann::json;
sqlite3* db;
std::mutex db_mutex;
std::queue<std::function<void()>> task_queue;
std::condition_variable cv;
bool running = true;
std::unordered_map<std::string, std::string> active_sessions;  // Active JWT sessions

// Function to execute SQL with transaction support
bool executeTransaction(const std::vector<std::string>& queries) {
    std::lock_guard<std::mutex> lock(db_mutex);
    sqlite3_exec(db, "BEGIN TRANSACTION;", nullptr, nullptr, nullptr);
    
    for (const auto& query : queries) {
        char* errMsg = nullptr;
        int rc = sqlite3_exec(db, query.c_str(), nullptr, nullptr, &errMsg);
        if (rc != SQLITE_OK) {
            sqlite3_exec(db, "ROLLBACK;", nullptr, nullptr, nullptr);
            sqlite3_free(errMsg);
            return false;
        }
    }
    
    sqlite3_exec(db, "COMMIT;", nullptr, nullptr, nullptr);
    return true;
}

// Function to generate JWT Token (for authentication)
std::string generateToken(const std::string& username) {
    auto token = jwt::create()
                     .set_issuer("auction_system")
                     .set_subject(username)
                     .set_expires_at(std::chrono::system_clock::now() + std::chrono::hours(1))
                     .sign(jwt::algorithm::hs256{"secret"});
    return token;
}

// Middleware to verify JWT Token
bool verifyToken(const std::string& token) {
    try {
        auto decoded = jwt::decode(token);
        auto username = decoded.get_subject();
        return active_sessions.find(username) != active_sessions.end();
    } catch (const std::exception& e) {
        return false;
    }
}

// Function to handle user login (JWT-based authentication)
CROW_ROUTE(app, "/login").methods("POST"_method)([](const crow::request& req) {
    auto data = json::parse(req.body);
    std::string username = data["username"];
    std::string password = data["password"];

    // Simple username/password check (you should use hashed passwords in a real app)
    if (username == "user" && password == "password") {
        std::string token = generateToken(username);
        active_sessions[username] = token;  // Store session
        return crow::response(200, "Login successful. Token: " + token);
    }

    return crow::response(400, "Invalid username or password.");
});

// Function to create an auction
CROW_ROUTE(app, "/create_auction").methods("POST"_method)([](const crow::request& req, crow::response& res) {
    auto data = json::parse(req.body);
    std::string item_name = data["item"];
    double starting_price = data["starting_price"];
    
    // Ensure user is authorized
    std::string token = req.get_header_value("Authorization");
    if (!verifyToken(token)) {
        res.code = 403;
        res.write("Unauthorized.");
        return res.end();
    }

    std::vector<std::string> queries = {
        "INSERT INTO auctions (item, starting_price, highest_bid, highest_bidder) VALUES ('" + item_name + "', " +
        std::to_string(starting_price) + ", 0.0, '');"
    };

    if (!executeTransaction(queries)) {
        res.code = 400;
        res.write("Failed to create auction.");
    } else {
        res.code = 200;
        res.write("Auction created successfully.");
    }
    res.end();
});

// Get all auctions
CROW_ROUTE(app, "/auctions").methods("GET"_method)([](const crow::request& req, crow::response& res) {
    std::string token = req.get_header_value("Authorization");
    if (!verifyToken(token)) {
        res.code = 403;
        res.write("Unauthorized.");
        return res.end();
    }

    const char* sql = "SELECT id, item, starting_price, highest_bid, highest_bidder FROM auctions;";
    sqlite3_stmt* stmt;
    sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr);

    json result = json::array();
    while (sqlite3_step(stmt) == SQLITE_ROW) {
        json auction;
        auction["id"] = sqlite3_column_int(stmt, 0);
        auction["item"] = std::string(reinterpret_cast<const char*>(sqlite3_column_text(stmt, 1)));
        auction["starting_price"] = sqlite3_column_double(stmt, 2);
        auction["highest_bid"] = sqlite3_column_double(stmt, 3);
        auction["highest_bidder"] = std::string(reinterpret_cast<const char*>(sqlite3_column_text(stmt, 4)));
        result.push_back(auction);
    }
    sqlite3_finalize(stmt);

    res.code = 200;
    res.write(result.dump());
    res.end();
});

// Get details of a single auction
CROW_ROUTE(app, "/auction/<int>").methods("GET"_method)([](const crow::request& req, crow::response& res, int auction_id) {
    std::string token = req.get_header_value("Authorization");
    if (!verifyToken(token)) {
        res.code = 403;
        res.write("Unauthorized.");
        return res.end();
    }

    const char* sql = "SELECT id, item, starting_price, highest_bid, highest_bidder FROM auctions WHERE id = ?;";
    sqlite3_stmt* stmt;
    sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr);
    sqlite3_bind_int(stmt, 1, auction_id);

    json result;
    if (sqlite3_step(stmt) == SQLITE_ROW) {
        result["id"] = sqlite3_column_int(stmt, 0);
        result["item"] = std::string(reinterpret_cast<const char*>(sqlite3_column_text(stmt, 1)));
        result["starting_price"] = sqlite3_column_double(stmt, 2);
        result["highest_bid"] = sqlite3_column_double(stmt, 3);
        result["highest_bidder"] = std::string(reinterpret_cast<const char*>(sqlite3_column_text(stmt, 4)));
    }
    sqlite3_finalize(stmt);

    if (result.empty()) {
        res.code = 404;
        res.write("Auction not found.");
    } else {
        res.code = 200;
        res.write(result.dump());
    }
    res.end();
});

// Place a bid with transactions and ACID compliance
CROW_ROUTE(app, "/bid").methods("POST"_method)([](const crow::request& req, crow::response& res) {
    auto data = json::parse(req.body);
    int auction_id = data["auction_id"];
    std::string bidder = data["bidder"];
    double bid_amount = data["bid_amount"];
    std::string token = req.get_header_value("Authorization");  // JWT Token

    if (!verifyToken(token)) {
        res.code = 403;
        res.write("Unauthorized.");
        return res.end();
    }

    double highest_bid = getHighestBid(auction_id);
    if (bid_amount <= highest_bid) {
        res.code = 400;
        res.write("Bid must be higher than the current highest bid.");
    } else {
        // Use a transaction for atomic bid placement
        std::vector<std::string> queries = {
            "UPDATE auctions SET highest_bid = " + std::to_string(bid_amount) +
            ", highest_bidder = '" + bidder + "' WHERE id = " + std::to_string(auction_id) + ";"
        };

        if (!executeTransaction(queries)) {
            res.code = 400;
            res.write("Failed to place bid.");
        } else {
            res.code = 200;
            res.write("Bid placed successfully.");
        }
    }

    res.end();
});

// Function to create tables if they do not exist
void setupDatabase() {
    executeSQL("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT UNIQUE, password TEXT);");
    executeSQL("CREATE TABLE IF NOT EXISTS auctions (id INTEGER PRIMARY KEY, item TEXT, starting_price REAL, highest_bid REAL, highest_bidder TEXT);");
}

int main() {
    crow::SimpleApp app;

    if (sqlite3_open("auction.db", &db)) {
        std::cerr << "Can't open database\n";
        return 1;
    }
    setupDatabase();

    // Start worker threads for processing bids
    const int NUM_WORKERS = std::thread::hardware_concurrency();
    std::vector<std::thread> workers;
    for (int i = 0; i < NUM_WORKERS; ++i) {
        workers.emplace_back(workerThread);
    }

    // Server endpoints
    // Place a bid with JWT validation (as above)

    app.port(8080).multithreaded().run();

    // Stop worker threads
    running = false;
    cv.notify_all();
    for (auto& worker : workers) {
        worker.join();
    }

    sqlite3_close(db);
}
