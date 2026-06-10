import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;

import java.io.*;
import java.net.InetSocketAddress;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicLong;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

public class TodoApp {

    // ── In-memory store ──────────────────────────────────────────────
    private static final List<Todo> todos = new CopyOnWriteArrayList<>();
    private static final AtomicLong idCounter = new AtomicLong(1);

    // ── Todo model ───────────────────────────────────────────────────
    static class Todo {
        long id;
        String text;
        String description;
        boolean completed;
        String createdAt;

        Todo(String text, String description) {
            this.id = idCounter.getAndIncrement();
            this.text = text;
            this.description = description;
            this.completed = false;
            this.createdAt = LocalDateTime.now()
                    .format(DateTimeFormatter.ofPattern("MMM d, h:mm a"));
        }

        String toJson() {
            return String.format(
                "{\"id\":%d,\"text\":\"%s\",\"description\":\"%s\",\"completed\":%b,\"createdAt\":\"%s\"}",
                id, escapeJson(text), escapeJson(description), completed, escapeJson(createdAt)
            );
        }

        static String escapeJson(String s) {
            if (s == null) return "";
            return s.replace("\\", "\\\\")
                    .replace("\"", "\\\"")
                    .replace("\n", "\\n")
                    .replace("\r", "\\r")
                    .replace("\t", "\\t");
        }
    }

    // ── Main ─────────────────────────────────────────────────────────
    public static void main(String[] args) throws IOException {
        int port = 8080;
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);

        // API routes
        server.createContext("/api/todos", new TodoApiHandler());

        // Static file serving (must be registered AFTER more-specific paths)
        server.createContext("/", new StaticFileHandler());

        server.setExecutor(null); // default executor
        server.start();

        System.out.println("==========================================");
        System.out.println("  Todo App running on port " + port);
        System.out.println("  http://localhost:" + port);
        System.out.println("==========================================");
    }

    // ── API Handler ──────────────────────────────────────────────────
    static class TodoApiHandler implements HttpHandler {

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String method = exchange.getRequestMethod();
            String path = exchange.getRequestURI().getPath();

            // CORS headers
            exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
            exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
            exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type");

            if ("OPTIONS".equalsIgnoreCase(method)) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            try {
                // Extract optional ID from path: /api/todos/{id}
                String idStr = path.replaceFirst("^/api/todos/?", "");
                Long id = idStr.isEmpty() ? null : Long.parseLong(idStr);

                switch (method.toUpperCase()) {
                    case "GET":
                        handleGet(exchange);
                        break;
                    case "POST":
                        handlePost(exchange);
                        break;
                    case "PUT":
                        if (id != null) handlePut(exchange, id);
                        else sendError(exchange, 400, "Missing todo ID");
                        break;
                    case "DELETE":
                        if (id != null) handleDelete(exchange, id);
                        else sendError(exchange, 400, "Missing todo ID");
                        break;
                    default:
                        sendError(exchange, 405, "Method not allowed");
                }
            } catch (NumberFormatException e) {
                sendError(exchange, 400, "Invalid ID format");
            } catch (Exception e) {
                e.printStackTrace();
                sendError(exchange, 500, "Internal server error");
            }
        }

        // GET /api/todos → return all todos as JSON array
        private void handleGet(HttpExchange exchange) throws IOException {
            StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < todos.size(); i++) {
                if (i > 0) sb.append(",");
                sb.append(todos.get(i).toJson());
            }
            sb.append("]");
            sendJson(exchange, 200, sb.toString());
        }

        // POST /api/todos → create a new todo
        private void handlePost(HttpExchange exchange) throws IOException {
            String body = readBody(exchange);
            String text = extractJsonValue(body, "text");
            String description = extractJsonValue(body, "description");

            if (text == null || text.trim().isEmpty()) {
                sendError(exchange, 400, "Task text is required");
                return;
            }
            if (description == null) {
                description = "";
            }

            Todo todo = new Todo(text.trim(), description.trim());
            todos.add(todo);
            sendJson(exchange, 201, todo.toJson());
        }

        // PUT /api/todos/{id} → toggle completed
        private void handlePut(HttpExchange exchange, long id) throws IOException {
            for (Todo todo : todos) {
                if (todo.id == id) {
                    // Read body to check if specific fields are being set
                    String body = readBody(exchange);
                    String completedStr = extractJsonValue(body, "completed");
                    if (completedStr != null) {
                        todo.completed = Boolean.parseBoolean(completedStr);
                    } else {
                        todo.completed = !todo.completed;
                    }
                    sendJson(exchange, 200, todo.toJson());
                    return;
                }
            }
            sendError(exchange, 404, "Todo not found");
        }

        // DELETE /api/todos/{id} → delete a todo
        private void handleDelete(HttpExchange exchange, long id) throws IOException {
            boolean removed = todos.removeIf(t -> t.id == id);
            if (removed) {
                sendJson(exchange, 200, "{\"message\":\"Deleted\"}");
            } else {
                sendError(exchange, 404, "Todo not found");
            }
        }

        // ── Helpers ──────────────────────────────────────────────────
        private String readBody(HttpExchange exchange) throws IOException {
            try (InputStream is = exchange.getRequestBody();
                 BufferedReader reader = new BufferedReader(new InputStreamReader(is, "UTF-8"))) {
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line);
                }
                return sb.toString();
            }
        }

        /**
         * Very simple JSON value extractor for flat objects.
         * Handles: {"key":"value"} and {"key":true/false}
         */
        private String extractJsonValue(String json, String key) {
            if (json == null) return null;
            String search = "\"" + key + "\"";
            int idx = json.indexOf(search);
            if (idx == -1) return null;

            int colonIdx = json.indexOf(':', idx + search.length());
            if (colonIdx == -1) return null;

            // Skip whitespace after colon
            int start = colonIdx + 1;
            while (start < json.length() && json.charAt(start) == ' ') start++;

            if (start >= json.length()) return null;

            if (json.charAt(start) == '"') {
                // String value
                int end = json.indexOf('"', start + 1);
                if (end == -1) return null;
                return json.substring(start + 1, end);
            } else {
                // Boolean / number value
                int end = start;
                while (end < json.length() && json.charAt(end) != ',' && json.charAt(end) != '}') {
                    end++;
                }
                return json.substring(start, end).trim();
            }
        }

        private void sendJson(HttpExchange exchange, int status, String json) throws IOException {
            byte[] bytes = json.getBytes("UTF-8");
            exchange.sendResponseHeaders(status, bytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        }

        private void sendError(HttpExchange exchange, int status, String message) throws IOException {
            String json = "{\"error\":\"" + Todo.escapeJson(message) + "\"}";
            sendJson(exchange, status, json);
        }
    }

    // ── Static File Handler ──────────────────────────────────────────
    static class StaticFileHandler implements HttpHandler {

        private static final Map<String, String> MIME_TYPES = new HashMap<>();
        static {
            MIME_TYPES.put("html", "text/html; charset=UTF-8");
            MIME_TYPES.put("css",  "text/css; charset=UTF-8");
            MIME_TYPES.put("js",   "application/javascript; charset=UTF-8");
            MIME_TYPES.put("json", "application/json; charset=UTF-8");
            MIME_TYPES.put("png",  "image/png");
            MIME_TYPES.put("jpg",  "image/jpeg");
            MIME_TYPES.put("jpeg", "image/jpeg");
            MIME_TYPES.put("svg",  "image/svg+xml");
            MIME_TYPES.put("ico",  "image/x-icon");
        }

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String uriPath = exchange.getRequestURI().getPath();

            // Default to index.html
            if ("/".equals(uriPath) || uriPath.isEmpty()) {
                uriPath = "/index.html";
            }

            // Resolve against public/ directory
            Path filePath = Paths.get("public", uriPath.substring(1)).normalize();

            // Security: prevent directory traversal
            if (!filePath.startsWith("public")) {
                send404(exchange);
                return;
            }

            if (!Files.exists(filePath) || Files.isDirectory(filePath)) {
                send404(exchange);
                return;
            }

            // Determine content type
            String fileName = filePath.getFileName().toString();
            String ext = "";
            int dotIdx = fileName.lastIndexOf('.');
            if (dotIdx > 0) ext = fileName.substring(dotIdx + 1).toLowerCase();
            String contentType = MIME_TYPES.getOrDefault(ext, "application/octet-stream");

            byte[] fileBytes = Files.readAllBytes(filePath);
            exchange.getResponseHeaders().set("Content-Type", contentType);
            exchange.sendResponseHeaders(200, fileBytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(fileBytes);
            }
        }

        private void send404(HttpExchange exchange) throws IOException {
            String msg = "404 Not Found";
            exchange.getResponseHeaders().set("Content-Type", "text/plain");
            exchange.sendResponseHeaders(404, msg.length());
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(msg.getBytes());
            }
        }
    }
}
