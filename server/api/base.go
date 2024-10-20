package api

import (
	C "server/constants"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/websocket/v2"
)

func SetupRoutes(router fiber.Router) {

	controller := &ChatController{}

	// WebSocket to receive messages
	router.Get("/receive/:id", websocket.New(controller.Ws))

	// Retrieve live user counts
	router.Get("/metadata", RateLimit(C.Tier3, 0), controller.GetChannelMetadata)

	// Send message to a site:channel
	router.Post("/send", RateLimit(C.Tier3, 0), controller.SendMessage)

	// Get previous messages of a site:channel, messageId=<> limit=50
	router.Get("/messages", RateLimit(C.Tier2, 0), controller.GetMessages)

	router.Get("/message/:_id", RateLimit(C.Tier2, 0), controller.GetMessage)

	// Add reactions/emojis to a message
	router.Post("/react/:MessageId", RateLimit(C.Tier2, 0), controller.AddRemoveReactions)

	// Report a message
	router.Post("/report/:MessageId", RateLimit(C.Tier2, 0), controller.ReportMessage)

	// Create new user
	router.Post("/register", RateLimit(C.Tier2, 0), controller.RegisterUser)

	// Update existing user flags
	router.Post("/update/user", RateLimit(C.Tier2, 0), controller.UpdateUser)

}
