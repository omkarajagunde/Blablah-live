package main

import (
	"fmt"
	"log"
	"os"
	"runtime"
	"server/api"
	"server/db"
	"server/models"
	"time"

	"net/http"
	"net/http/pprof"
	_ "net/http/pprof"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/requestid"
	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
)

func main() {
	// Launch pprof in a different goroutine
	go func() {
		router := mux.NewRouter()

		router.HandleFunc(
			"/debug/pprof/", pprof.Index,
		)
		router.HandleFunc(
			"/debug/pprof/cmdline", pprof.Cmdline,
		)
		router.HandleFunc(
			"/debug/pprof/profile", pprof.Profile,
		)
		router.HandleFunc(
			"/debug/pprof/symbol", pprof.Symbol,
		)
		router.HandleFunc(
			"/debug/pprof/trace", pprof.Trace,
		)
		router.Handle(
			"/debug/pprof/goroutine", pprof.Handler("goroutine"),
		)
		router.Handle(
			"/debug/pprof/heap", pprof.Handler("heap"),
		)
		router.Handle(
			"/debug/pprof/threadcreate", pprof.Handler("threadcreate"),
		)
		router.Handle(
			"/debug/pprof/block", pprof.Handler("block"),
		)
		router.Handle(
			"/debug/vars", http.DefaultServeMux,
		)

		http.ListenAndServe(":6060", router)
	}()

	godotenv.Load(".env")

	app := fiber.New()

	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization, X-Id",
		AllowMethods: "GET, POST, PUT, DELETE, PATCH, HEAD",
	}))

	// Connect redis DB
	// db.RedisInit()

	// Connect Mongo DB
	messageCollection, ctx := db.MongoInit("messages")
	models.CreateMessageService(messageCollection, ctx)

	usersCollection, ctx := db.MongoInit("users")
	models.CreateUserService(usersCollection, ctx)

	app.Use(requestid.New())

	// Setup APIs
	api.SetupRoutes(app)

	go func() {
		// Create a ticker that triggers every 5 seconds
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()

		// Infinite loop to print the number of Goroutines
		for range ticker.C {
			// Get the number of running Goroutines
			numGoroutines := runtime.NumGoroutine()
			fmt.Printf("Number of Running Goroutines: %d\n", numGoroutines)

		}
	}()

	// Set GOMAXPROCS to utilize all available CPU cores
	maxCores := runtime.NumCPU()
	fmt.Printf("maxCores value: %d\n", maxCores)

	runtime.GOMAXPROCS(8)
	fmt.Printf("Updated GOMAXPROCS value: %d\n", runtime.GOMAXPROCS(0))

	go models.ListenAllChanges()

	PORT := os.Getenv("PORT")
	log.Fatal(app.Listen(":" + PORT))

}
