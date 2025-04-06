#include <crow.h>
#include <iostream>
#include <vector>
#include <string>
#include <sqlite3.h>
#include <nlohmann/json.hpp>
#include <thread>
#include <mutex>
#include <queue>
#include <condition_variable>
#include <unordered_map>
#include <sstream>
#include <iomanip>
#include <ctime>
#include "jwt-cpp/jwt.h"  // For JWT token handling

using json = nlohmann::json;
sqlite3* db;
std::mutex db_mutex;
std::queue<std::function<void()>> task_queue;
std::condition_variable cv;
bool running = true;
std::unordered_map<std::string, std::string> active_sessions;  // Active JWT sessions

struct CORS
{
// Per-request context (not used here, but required by Crow’s middleware interface)
struct context {};

// Called before each request is handled
void before_handle(crow::request& req, crow::response& res, context&)
{
    // Always set the CORS headers
    res.add_header("Access-Control-Allow-Origin", "*");
    res.add_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.add_header("Access-Control-Allow-Headers", "Content-Type, Authorization");

    // If it’s an OPTIONS request, immediately return (typical CORS preflight behavior)
    if (req.method == "OPTIONS"_method)
    {
        // You can use a 200 or 204 here; 204 = No Content
        res.code = 204;
        res.end();
    }
}

// Called after each request is handled
void after_handle(crow::request& /*req*/, crow::response& res, context&)
{
    // Ensure that every response has the CORS headers as well
  //  res.add_header("Access-Control-Allow-Origin", "*");
}
};

crow::App<CORS> app;

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
} catch (const std::exception&) {
return false;
}
}

// Function to get the highest bid for an auction
double getHighestBid(int auction_id) {
    std::lock_guard<std::mutex> lock(db_mutex);
    const char* sql = "SELECT highest_bid FROM auctions WHERE id = ?;";
    sqlite3_stmt* stmt;
    sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr);
    sqlite3_bind_int(stmt, 1, auction_id);
    
    double highest_bid = 0.0;
    if (sqlite3_step(stmt) == SQLITE_ROW) {
        highest_bid = sqlite3_column_double(stmt, 0);
    }
    sqlite3_finalize(stmt);
    return highest_bid;
}

// Helper function to get the end_datetime for an auction (as text)
std::string getAuctionEndTime(int auction_id) {
    std::lock_guard<std::mutex> lock(db_mutex);
const char* sql = "SELECT end_datetime FROM auctions WHERE id = ?;";
sqlite3_stmt* stmt;
sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr);
sqlite3_bind_int(stmt, 1, auction_id);

std::string end_time;
if (sqlite3_step(stmt) == SQLITE_ROW) {
    const unsigned char* text_ptr = sqlite3_column_text(stmt, 0);
    if (text_ptr) {
        end_time = reinterpret_cast<const char*>(text_ptr);
    }
}
sqlite3_finalize(stmt);
return end_time;
}

// Parse a string datetime "YYYY-MM-DD HH:MM:SS" into a time_point
// Returns time_point of epoch if parsing fails or string empty
std::chrono::system_clock::time_point parseDateTime(const std::string& datetime_str) {
if (datetime_str.empty()) {
return std::chrono::system_clock::time_point{};
}
std::tm tm{};
std::istringstream ss(datetime_str);
ss >> std::get_time(&tm, "%Y-%m-%d %H:%M:%S");
if (ss.fail()) {
// If parse fails, return epoch
return std::chrono::system_clock::time_point{};
}
auto time_c = std::mktime(&tm);
return std::chrono::system_clock::from_time_t(time_c);
}

// Worker thread function
void workerThread() {
    while (running) {
        std::function<void()> task;
        {
            std::unique_lock<std::mutex> lock(db_mutex);
            cv.wait(lock, [] { return !task_queue.empty() || !running; });
            if (!running && task_queue.empty()) {
                return;
            }
            task = std::move(task_queue.front());
            task_queue.pop();
        }
        task();
    }
}

// Function to execute SQL queries (non-transactional)
bool executeSQL(const std::string& query) {
    std::lock_guard<std::mutex> lock(db_mutex);
char* errMsg = nullptr;
int rc = sqlite3_exec(db, query.c_str(), nullptr, nullptr, &errMsg);
if (rc != SQLITE_OK) {
std::cerr << "SQL error: " << (errMsg ? errMsg : "") << "\n";
sqlite3_free(errMsg);
return false;
}
return true;
}

// Function to create or update the auctions table schema
void setupDatabase() {
// Create the users table if it does not exist
executeSQL("CREATE TABLE IF NOT EXISTS users ("
"id INTEGER PRIMARY KEY, "
"username TEXT UNIQUE, "
"password TEXT);");

// Create the auctions table if it doesn't exist
executeSQL("CREATE TABLE IF NOT EXISTS auctions ("
           "id INTEGER PRIMARY KEY, "
           "item TEXT, "
           "starting_price REAL, "
           "highest_bid REAL, "
           "highest_bidder TEXT, "
           "end_datetime TEXT);");

// Attempt to add the 'end_datetime' column if it doesn't exist
executeSQL("ALTER TABLE auctions ADD COLUMN end_datetime TEXT;");

// --------------------------------------------------------------------------------
// NEW: Add a column "owner" (the username of whoever created the listing) if it
// doesn't already exist. This will fail silently if the column already exists.
// --------------------------------------------------------------------------------
executeSQL("ALTER TABLE auctions ADD COLUMN owner TEXT;");
}

int main() {
// Open the database
if (sqlite3_open("auction.db", &db)) {
std::cerr << "Can't open database\n";
return 1;
}
setupDatabase();

// Start worker threads for processing bids
const int NUM_WORKERS = std::max(1u, std::thread::hardware_concurrency());
std::vector<std::thread> workers;
workers.reserve(NUM_WORKERS);
for (int i = 0; i < NUM_WORKERS; ++i) {
    workers.emplace_back(workerThread);
}

// --------------------------------------------------------------------
// User Registration
// --------------------------------------------------------------------
CROW_ROUTE(app, "/register").methods("POST"_method)(
[](const crow::request& req){
    auto data = json::parse(req.body);
    std::string username = data["username"];
    std::string password = data["password"];

    // Insert user into database
    std::lock_guard<std::mutex> lock(db_mutex);
    sqlite3_stmt* stmt;
    const char* sql = "INSERT INTO users (username, password) VALUES (?, ?);";
    if (sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr) != SQLITE_OK) {
        return crow::response(500, "Database error (prepare failed).");
    }
    sqlite3_bind_text(stmt, 1, username.c_str(), -1, SQLITE_TRANSIENT);
    sqlite3_bind_text(stmt, 2, password.c_str(), -1, SQLITE_TRANSIENT);

    if (sqlite3_step(stmt) != SQLITE_DONE) {
        sqlite3_finalize(stmt);
        return crow::response(400, "Username already exists or invalid input.");
    }
    sqlite3_finalize(stmt);

    return crow::response(200, "Registration successful.");
});

// --------------------------------------------------------------------
// User Login
// --------------------------------------------------------------------
CROW_ROUTE(app, "/login").methods("POST"_method)(
[](const crow::request& req) {
    auto data = json::parse(req.body);
    std::string username = data["username"];
    std::string password = data["password"];

    // Query the database to verify credentials
    std::lock_guard<std::mutex> lock(db_mutex);
    sqlite3_stmt* stmt;
    const char* sql = "SELECT password FROM users WHERE username = ? LIMIT 1;";
    if (sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr) != SQLITE_OK) {
        return crow::response(500, "Database error (prepare failed).");
    }
    sqlite3_bind_text(stmt, 1, username.c_str(), -1, SQLITE_TRANSIENT);

    std::string stored_password;
    if (sqlite3_step(stmt) == SQLITE_ROW) {
        stored_password = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 0));
    }
    sqlite3_finalize(stmt);

    if (stored_password.empty()) {
        // username not found
        return crow::response(400, "Invalid username or password.");
    }

    if (stored_password == password) {
        std::string token = generateToken(username);
        active_sessions[username] = token;  // Store the token in active_sessions
        return crow::response(200, "Login successful. Token: " + token);
    } else {
        return crow::response(400, "Invalid username or password.");
    }
});

// --------------------------------------------------------------------
// Create an auction (with end_datetime & owner)
// --------------------------------------------------------------------
CROW_ROUTE(app, "/create_auction").methods("POST"_method)(
[](const crow::request& req, crow::response& res) {
    // Ensure user is authorized
    std::string token = req.get_header_value("Authorization");
    if (!verifyToken(token)) {
        res.code = 403;
        res.write("Unauthorized.");
        return res.end();
    }

    // Decode token again to get the username (owner)
    std::string username;
    try {
        auto decoded = jwt::decode(token);
        username = decoded.get_subject();
    } catch (const std::exception&) {
        res.code = 403;
        res.write("Invalid Token.");
        return res.end();
    }

    auto data = json::parse(req.body);
    std::string item_name     = data["item"];
    double starting_price     = data["starting_price"];
    std::string end_datetime  = data["end_datetime"];  // e.g. "2024-01-01 12:30:00"

    // Insert listing with "owner" = the user who created it
    std::vector<std::string> queries = {
        "INSERT INTO auctions (item, starting_price, highest_bid, highest_bidder, end_datetime, owner) VALUES ('"
             + item_name + "', "
             + std::to_string(starting_price) + ", "
             + "0.0, '', '"
             + end_datetime + "', '"
             + username     + "');"
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

// --------------------------------------------------------------------
// Get all auctions
// --------------------------------------------------------------------
CROW_ROUTE(app, "/auctions").methods("GET"_method)(
[](const crow::request& req, crow::response& res) {
    std::string token = req.get_header_value("Authorization");
    if (!verifyToken(token)) {
        res.code = 403;
        res.write("Unauthorized.");
        return res.end();
    }

    const char* sql = "SELECT id, item, starting_price, highest_bid, highest_bidder, end_datetime, owner "
                      "FROM auctions;";
    sqlite3_stmt* stmt;
    sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr);

    json result = json::array();
    while (sqlite3_step(stmt) == SQLITE_ROW) {
        json auction;
        auction["id"]             = sqlite3_column_int(stmt, 0);
        auction["item"]           = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 1));
        auction["starting_price"] = sqlite3_column_double(stmt, 2);
        auction["highest_bid"]    = sqlite3_column_double(stmt, 3);
        auction["highest_bidder"] = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 4));
        const unsigned char* ed   = sqlite3_column_text(stmt, 5);
        auction["end_datetime"]   = ed ? reinterpret_cast<const char*>(ed) : "";
        const unsigned char* ow   = sqlite3_column_text(stmt, 6);
        auction["owner"]          = ow ? reinterpret_cast<const char*>(ow) : "";
        result.push_back(auction);
    }
    sqlite3_finalize(stmt);

    res.code = 200;
    res.write(result.dump());
    res.end();
});

// --------------------------------------------------------------------
// Get details of a single auction
// --------------------------------------------------------------------
CROW_ROUTE(app, "/auction/<int>").methods("GET"_method)(
[](const crow::request& req, crow::response& res, int auction_id) {
    std::string token = req.get_header_value("Authorization");
    if (!verifyToken(token)) {
        res.code = 403;
        res.write("Unauthorized.");
        return res.end();
    }

    const char* sql = "SELECT id, item, starting_price, highest_bid, highest_bidder, end_datetime, owner "
                      "FROM auctions WHERE id = ?;";
    sqlite3_stmt* stmt;
    sqlite3_prepare_v2(db, sql, -1, &stmt, nullptr);
    sqlite3_bind_int(stmt, 1, auction_id);

    json result;
    if (sqlite3_step(stmt) == SQLITE_ROW) {
        result["id"]             = sqlite3_column_int(stmt, 0);
        result["item"]           = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 1));
        result["starting_price"] = sqlite3_column_double(stmt, 2);
        result["highest_bid"]    = sqlite3_column_double(stmt, 3);
        result["highest_bidder"] = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 4));
        const unsigned char* ed  = sqlite3_column_text(stmt, 5);
        result["end_datetime"]   = ed ? reinterpret_cast<const char*>(ed) : "";
        const unsigned char* ow  = sqlite3_column_text(stmt, 6);
        result["owner"]          = ow ? reinterpret_cast<const char*>(ow) : "";
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

// --------------------------------------------------------------------
// Place a bid (checks if auction is not ended)
// --------------------------------------------------------------------
CROW_ROUTE(app, "/bid").methods("POST"_method)(
[](const crow::request& req, crow::response& res) {
    auto data       = json::parse(req.body);
    int auction_id  = data["auction_id"];
    std::string bidder = data["bidder"];
    double bid_amount   = data["bid_amount"];
    std::string token   = req.get_header_value("Authorization");  // JWT Token

    if (!verifyToken(token)) {
        res.code = 403;
        res.write("Unauthorized.");
        return res.end();
    }

    // Check if auction has ended
    std::string end_datetime_str = getAuctionEndTime(auction_id);
    auto end_tp = parseDateTime(end_datetime_str);
    auto now = std::chrono::system_clock::now();

    if (!end_datetime_str.empty() &&
        end_tp != std::chrono::system_clock::time_point{} &&
        now >= end_tp) {
        // Auction has ended
        res.code = 400;
        res.write("Cannot bid on an ended auction.");
        return res.end();
    }

    // Otherwise, check if the bid amount is higher than the current highest bid
    double highest_bid = getHighestBid(auction_id);
    if (bid_amount <= highest_bid) {
        res.code = 400;
        res.write("Bid must be higher than the current highest bid.");
    } else {
        // Use a transaction for atomic bid placement
        std::vector<std::string> queries = {
            "UPDATE auctions SET highest_bid = " + std::to_string(bid_amount)
            + ", highest_bidder = '" + bidder
            + "' WHERE id = " + std::to_string(auction_id) + ";"
        };

        if (!executeTransaction(queries)) {
            res.code = 400;
            res.write("Failed to place bid (transaction error).");
        } else {
            res.code = 200;
            res.write("Bid placed successfully.");
        }
    }
    res.end();
});

// Start the server
app.port(8080).multithreaded().run();

// Stop worker threads
running = false;
cv.notify_all();
for (auto& worker : workers) {
    worker.join();
}

// Close database
sqlite3_close(db);
return 0;
}