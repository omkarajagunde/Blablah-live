package api

import (
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"server/db"
	"server/models"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/log"
	"github.com/gofiber/websocket/v2"
	"go.mongodb.org/mongo-driver/bson"
)

var channels = make(map[string]bool)

// ChatController implements the Controllers interface
type ChatController struct{}

var connections = make(map[string]*db.UserSocket)

// Ws handles WebSocket connections
func (c *ChatController) Ws(conn *websocket.Conn) {
	// Extract userId from query parameters
	userId := conn.Params("id")
	if userId != "" {
		user, isErr := models.GetUser(userId)
		if isErr {
			conn.WriteControl(
				websocket.CloseMessage,
				websocket.FormatCloseMessage(websocket.CloseNormalClosure, "User not found"),
				time.Now().Add(time.Second),
			)
			conn.Close()
		}

		connections[userId] = &db.UserSocket{
			UserId:         userId,
			Conn:           conn,
			IsActive:       true,
			LastStreamQuit: make(chan bool),
		}

		log.Info("User connected - ", userId)

		if user != nil && user.ActiveSite != "" {
			_, ok := channels[user.ActiveSite]
			if !ok {
				go models.ListenChannel(user.ActiveSite)
				channels[user.ActiveSite] = true
			}
		}

		for {
		}
	}
}

// SendMessage handles sending messages
func (c *ChatController) SendMessage(ctx *fiber.Ctx) error {

	var message models.MessageModel
	var userId string = ctx.Get("X-Id")
	var siteId string = ctx.Query("SiteId")

	if userId == "" {
		return ctx.Status(400).JSON(fiber.Map{
			"message": "User id not passed",
			"status":  400,
		})
	}

	user, isErr := models.GetUser(userId)
	if isErr {
		return ctx.Status(500).JSON(fiber.Map{
			"status":  500,
			"message": "User not found, for passed user id!",
			"code":    "USER_NOT_FOUND",
		})
	}

	if user != nil {
		user.ModifiedAt = time.Now()
	}

	if user != nil && user.ActiveSite != "" {
		if user.ActiveSite != siteId {
			return ctx.Status(500).JSON(fiber.Map{
				"status":  500,
				"message": "User is not active on this channel, not allowed to send message",
				"code":    "USER_NOT_ACTIVE_ON_SITE",
			})
		}

	}

	// Parse the JSON body into the struct
	if err := ctx.BodyParser(&message); err != nil {
		log.Error("err - ", err)
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  fiber.StatusBadRequest,
			"message": "Failed to parse body",
		})
	}

	msgId := models.WriteMessageToChannel(message)

	return ctx.Status(200).JSON(fiber.Map{
		"message": "Message sent successfully",
		"status":  200,
		"MsgId":   msgId,
	})

}

// GetMessages retrieves a list of messages
func (c *ChatController) GetMessages(ctx *fiber.Ctx) error {

	return ctx.Status(200).JSON(fiber.Map{
		"message": "Messages sent to site successfully",
		"status":  200,
	})
}

// AddRemoveReactions handles adding or removing reactions to messages
func (c *ChatController) AddRemoveReactions(ctx *fiber.Ctx) error {
	return ctx.Status(200).JSON(fiber.Map{
		"message": "Added reaction successfully",
		"status":  200,
	})
}

// ReportMessage handles reporting a message for inappropriate content
func (c *ChatController) ReportMessage(ctx *fiber.Ctx) error {
	return ctx.Status(200).JSON(fiber.Map{
		"message": "Message reported successfully",
		"status":  200,
	})
}

func (c *ChatController) RegisterUser(ctx *fiber.Ctx) error {
	userId := ctx.Get("X-Id")
	if userId != "" {
		_, isErr := models.GetUser(userId)
		if isErr {
			return ctx.Status(500).JSON(fiber.Map{
				"status":  500,
				"message": "User not found, for passed user id, to create new user don't pass X-Id header",
			})
		}

		return ctx.Status(200).JSON(fiber.Map{
			"status":  200,
			"message": "User already exists",
		})
	}

	// User id not detected, create new user
	if user, ok := models.NewUser(ctx); ok {
		userJSON, err := json.Marshal(user)
		if err != nil {
			fmt.Println("Error marshalling to JSON:", err)
			return ctx.Status(500).JSON(fiber.Map{
				"status": 500,
			})
		}

		return ctx.Status(200).JSON(fiber.Map{
			"message": "user created successfully",
			"status":  200,
			"data":    string(userJSON),
			"id":      string(user.Id),
		})
	}

	return ctx.Status(500).JSON(fiber.Map{
		"message": "User creation failed",
		"status":  500,
	})

}

// ConvertUserToBsonM converts a UserModel struct to bson.M
func convert_UserToBsonM(user models.UserModel) (bson.M, error) {
	// Step 1: Marshal the UserModel struct into BSON
	userBson, err := bson.Marshal(user)
	if err != nil {
		return nil, err
	}

	// Step 2: Unmarshal the BSON into bson.M
	var userMap bson.M
	err = bson.Unmarshal(userBson, &userMap)
	if err != nil {
		return nil, err
	}

	return userMap, nil
}

func (c *ChatController) UpdateUser(ctx *fiber.Ctx) error {
	userId := ctx.Get("X-Id")
	if userId != "" {
		user, isErr := models.GetUser(userId)
		if isErr {
			return ctx.Status(400).JSON(fiber.Map{
				"status":  400,
				"message": "User not found",
			})
		}

		siteId := ctx.Query("SiteId", "USER_NOT_IN_PLUGIN")
		isOnline := ctx.Query("IsOnline", "false")

		if user != nil {
			user.ModifiedAt = time.Now()
			if val, err := strconv.ParseBool(isOnline); err == nil {
				log.Debug("IsOnline - ", val)
				if val {
					user.IsOnline = true
					user.ActiveSite = siteId

					_, ok := channels[user.ActiveSite]
					if !ok {
						go models.ListenChannel(user.ActiveSite)
						channels[user.ActiveSite] = true
					}

				} else {
					user.IsOnline = false
				}
			}

			array := []string{}
			flag := false
			for _, site := range user.ExploredSites {
				if site == siteId {
					flag = true
				}
			}

			if !flag {
				array = append(array, siteId)
				user.ExploredSites = array
			}

			userMap, convertErr := convert_UserToBsonM(*user)
			if convertErr != nil {
				log.Fatal("Failed to convert UserModel to bson.M:", convertErr)
			}

			err := models.UpdateUser(userId, userMap)

			if err != nil {
				log.Debug(err)
				return ctx.Status(500).JSON(fiber.Map{
					"status":  500,
					"message": err,
				})
			}

			return ctx.Status(200).JSON(fiber.Map{
				"status":  200,
				"message": "User updated successfully...",
			})
		}

	}

	return ctx.Status(400).JSON(fiber.Map{
		"status":  400,
		"message": "User id not passed correctly",
	})
}
