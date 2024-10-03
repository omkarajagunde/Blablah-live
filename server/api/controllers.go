package api

import (
	"encoding/json"
	"fmt"
	"strconv"
	"sync"
	"time"

	"server/db"
	"server/models"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/log"
	"github.com/gofiber/websocket/v2"
	"go.mongodb.org/mongo-driver/bson"
)

var channels = make(map[string]bool)

// Mutex to protect the counter
var mutex sync.Mutex

// ChatController implements the Controllers interface
type ChatController struct{}

// Ws handles WebSocket Connections
func (c *ChatController) Ws(conn *websocket.Conn) {
	// Extract userId from query parameters
	userId := conn.Params("id")
	siteId := conn.Query("SiteId")
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

		// Setting a close handler
		conn.SetCloseHandler(func(code int, text string) error {
			fmt.Printf("Connection closed with code: %d, reason: %s, user: %s", code, text, userId)
			return nil
		})

		mutex.Lock()
		db.Connections[userId] = &db.UserSocket{
			UserId:     userId,
			Conn:       conn,
			IsActive:   true,
			ActiveSite: siteId,
		}
		fmt.Printf("User connected - %s\n", userId)
		mutex.Unlock()

		defer func() {
			fmt.Printf("User disconnected - %s\n", userId)
			conn.Close()
			mutex.Lock()
			db.Connections[userId].IsActive = false
			mutex.Unlock()
		}()

		if user != nil && user.ActiveSite != "" {
			_, ok := channels[user.ActiveSite]
			if !ok {
				// go models.ListenChannel(user.ActiveSite)
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

	userId := ctx.Get("X-Id")
	siteId := ctx.Query("SiteId")
	bookmark := ctx.Query("Bookmark", "")

	if userId == "" {
		return ctx.Status(400).JSON(fiber.Map{
			"message": "User id not passed",
			"status":  400,
		})
	}

	_, isErr := models.GetUser(userId)
	if isErr {
		return ctx.Status(500).JSON(fiber.Map{
			"status":  500,
			"message": "User not found, for passed user id!",
			"code":    "USER_NOT_FOUND",
		})
	}

	chatArray, bookmark, hasMoreMessages, retrievalErr := models.GetMessages(25, siteId, bookmark)
	if retrievalErr != nil {
		return ctx.Status(500).JSON(fiber.Map{
			"message": retrievalErr,
			"status":  500,
		})
	}
	return ctx.Status(200).JSON(fiber.Map{
		"message":      "Messages sent to site successfully",
		"status":       200,
		"data":         chatArray,
		"nextBookmark": bookmark,
		"hasMore":      hasMoreMessages,
	})
}

// AddRemoveReactions handles adding or removing reactions to messages
func (c *ChatController) AddRemoveReactions(ctx *fiber.Ctx) error {

	userId := ctx.Get("X-Id", "")
	msgId := ctx.Params("MessageId", "")

	if userId == "" {
		return ctx.Status(400).JSON(fiber.Map{
			"message": "User id not passed",
			"status":  400,
		})
	}

	var reaction map[string]string
	// Parse the JSON body into the struct
	if err := ctx.BodyParser(&reaction); err != nil {
		log.Error("err - ", err)
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  fiber.StatusBadRequest,
			"message": "Failed to parse body",
		})
	}

	updatedRecord, updateErr := models.AddRemoveReaction(msgId, reaction["emoji"], userId)
	if updateErr != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"status":  fiber.StatusInternalServerError,
			"message": updateErr,
		})
	}

	return ctx.Status(200).JSON(fiber.Map{
		"message": "Added reaction successfully",
		"status":  200,
		"data":    updatedRecord,
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
				if val {
					user.IsOnline = true
					user.ActiveSite = siteId

					_, connExists := db.Connections[userId]
					if connExists {
						mutex.Lock()
						db.Connections[userId].ActiveSite = siteId
						mutex.Unlock()
					}

					_, channelExists := channels[user.ActiveSite]
					if !channelExists {
						// go models.ListenChannel(user.ActiveSite)
						channels[user.ActiveSite] = true
					}

				} else {
					user.IsOnline = false
					mutex.Lock()
					db.Connections[userId].ActiveSite = siteId
					db.Connections[userId].IsActive = false
					db.Connections[userId].Conn.Close()
					fmt.Printf("User went offline: %s\n", userId)
					mutex.Unlock()
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
