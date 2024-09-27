package main

import (
	"log"
	"os"
	"server/api"
	"server/db"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/requestid"
	"github.com/joho/godotenv"
)

func main() {

	if godotenv.Load(".env") != nil {
		log.Fatal("Error loading .env file")
	}

	app := fiber.New()

	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept, Authorization, X-Id",
		AllowMethods: "GET, POST, PUT, DELETE, PATCH, HEAD",
	}))

	// Connect redis DB
	db.Init()

	app.Use(requestid.New())

	// Setup APIs
	api.SetupRoutes(app)

	PORT := os.Getenv("PORT")
	log.Fatal(app.Listen(PORT))

}
