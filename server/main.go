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

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/requestid"
	"github.com/joho/godotenv"
)

func main() {

	godotenv.Load(".env")

	app := fiber.New()

	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization, X-Id",
		AllowMethods: "GET, POST, PUT, DELETE, PATCH, HEAD",
	}))

	// Connect redis DB
	db.RedisInit()

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
		ticker := time.NewTicker(2 * time.Minute)
		defer ticker.Stop()

		// Infinite loop to print the number of Goroutines
		for range ticker.C {
			// Get the number of running Goroutines
			numGoroutines := runtime.NumGoroutine()
			fmt.Printf("Number of Running Goroutines: %d\n", numGoroutines)
		}
	}()

	PORT := os.Getenv("PORT")
	log.Fatal(app.Listen(":" + PORT))

}
