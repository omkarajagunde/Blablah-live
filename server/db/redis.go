package db

import (
	"context"
	"fmt"
	"os"
	"sync"

	"github.com/go-redis/redis/v8"
	"github.com/gofiber/fiber/v2/log"
	"github.com/gofiber/websocket/v2"
)

// Message representation
type MessageModel struct {
	Timestamp string                 `json:"Timestamp"`
	Message   string                 `json:"Message"`
	To        string                 `json:"To"`
	From      map[string]interface{} `json:"From"`
	Reactions map[string]interface{} `json:"Reactions"`
	Flagged   []interface{}          `json:"Flagged"`
}

type UserSocket struct {
	UserId     string
	Conn       *websocket.Conn
	IsActive   bool
	ActiveSite string
}

var (
	ctx         = context.Background()
	client      *redis.Client
	mutex       sync.Mutex
	Connections = make(map[string]*UserSocket)
)

func RedisInit() bool {

	// Parse the Redis URL and connect
	options, parseErr := redis.ParseURL(os.Getenv("REDIS_URL"))
	if parseErr != nil {
		log.Fatalf("Failed to parse Redis URL: %v", parseErr)
	}

	// Create a new Redis client
	client = redis.NewClient(options)

	// Ping Redis to ensure the connection is successful
	_, err := client.Ping(ctx).Result()
	if err != nil {
		log.Fatalf("Could not connect to Redis: %v", err)
		return false
	}
	log.Debug("Connected to Redis")
	return true
}

func Set(hashId string, mp map[string]interface{}) (bool, error) {
	mutex.Lock()
	// Add entries to the hash set
	_, err := client.HSet(ctx, hashId, mp).Result()
	mutex.Unlock()
	if err != nil {
		log.Error("Could not add entry to hash set: %v", err)
		return false, err
	}
	log.Debug("Entry added to hash set for hashId - ", hashId)
	return true, nil
}

func Get(hashId string) (map[string]interface{}, bool) {
	// Add entries to the hash set
	hashValuesInterfaceMap := make(map[string]interface{})
	mutex.Lock()
	hashValuesStringMap, err := client.HGetAll(ctx, hashId).Result()
	mutex.Unlock()
	if err != nil {
		log.Error("Could not add entry to hash set: %v", err)
		return nil, true
	}

	// Iterate over the original map and convert map[string]string returned by redis to map[string]interface{}
	for key, value := range hashValuesStringMap {
		hashValuesInterfaceMap[key] = string(value)
	}

	if len(hashValuesInterfaceMap) == 0 {
		return nil, true
	}

	return hashValuesInterfaceMap, false
}

func Exists(hashId string) bool {
	if present, err := client.HExists(ctx, hashId, "Id").Result(); present && err == nil {
		return true
	}

	return false
}

func StreamExists(siteId string) bool {
	_, err := client.XInfoStream(ctx, siteId).Result()

	// If no stream exists, Redis returns an error
	if err != nil {
		if err == redis.Nil {
			return false
		} else {
			log.Fatalf("Error checking stream %s: %v", siteId, err)
		}
	}
	fmt.Printf("Stream %s exists\n", siteId)
	return true
}

func StartStreamConsumer(streamName string, user *UserSocket) {

	// defer func() {
	// 	close(user.LastStreamQuit)
	// }()

	for {

		result, err := client.XRead(ctx, &redis.XReadArgs{
			Streams: []string{streamName, "$"},
			Count:   1,
			Block:   0,
		}).Result()

		if err != nil {
			fmt.Printf("Error reading from stream %s: %v", streamName, err)
			return
		}

		log.Info("Stream reading - ", streamName, " for user - ", user.UserId)

		for _, stream := range result {
			for _, message := range stream.Messages {
				log.Info("message -- ", message.ID)
				// Send message to the user via WebSocket
				err := user.Conn.WriteJSON(map[string]interface{}{
					"MsgId":  message.ID,
					"Values": message.Values,
				})
				if err != nil {
					fmt.Printf("Error sending message to user %s: %v", user.UserId, err)
					return
				}

				// Acknowledge the message
				// _, err = client.XAck(ctx, streamName, "mygroup", message.ID).Result()
				// if err != nil {
				// 	fmt.Printf("Error acknowledging message: %v", err)
				// }
			}
		}

	}
}
