package models

import (
	"context"
	"fmt"
	"server/db"
	"time"

	"github.com/gofiber/fiber/v2/log"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Message representation
type MessageModel struct {
	Id        primitive.ObjectID     `bson:"_id"`
	CreatedAt time.Time              `bson:"created_at"`
	UpdatedAt time.Time              `bson:"updated_at"`
	Message   string                 `bson:"message"`
	ChannelId string                 `bson:"channel"`
	To        string                 `json:"to"`
	From      map[string]interface{} `json:"from"`
	Reactions map[string]interface{} `json:"reactions"`
	Flagged   []interface{}          `json:"flagged"`
}

type MessageService struct {
	Collection *mongo.Collection
	ctx        context.Context
}

var messageService MessageService

func CreateMessageService(collection *mongo.Collection, ctx context.Context) {
	messageService = MessageService{Collection: collection, ctx: ctx}
}

func WriteMessageToChannel(message MessageModel) interface{} {

	message.Id = primitive.NewObjectID()
	message.CreatedAt = time.Now()
	message.UpdatedAt = time.Now()

	result, streamErr := messageService.Collection.InsertOne(messageService.ctx, message)
	if streamErr != nil {
		log.Error("%s", streamErr)
	}

	log.Info("Msg written:", result.InsertedID)
	return result.InsertedID
}

// AddReaction adds or updates a reaction in the message's reactions map
func AddReaction(messageID primitive.ObjectID, reactionKey string, count interface{}) (*mongo.UpdateResult, error) {
	filter := bson.M{"_id": messageID}
	update := bson.M{"$set": bson.M{"reactions." + reactionKey: count, "updated_at": time.Now()}}

	result, err := messageService.Collection.UpdateOne(messageService.ctx, filter, update)
	if err != nil {
		return nil, err
	}
	return result, nil
}

// FlagMessage toggles (adds/removes) a user in the flagged array (add if not exists, remove if exists)
func FlagMessage(messageID primitive.ObjectID, userID interface{}) (*mongo.UpdateResult, error) {
	filter := bson.M{"_id": messageID}

	// Check if the user is already flagged
	message := MessageModel{}
	err := messageService.Collection.FindOne(messageService.ctx, filter).Decode(&message)
	if err != nil {
		return nil, err
	}

	// Check if user is already in flagged array
	isFlagged := false
	for _, v := range message.Flagged {
		if v == userID {
			isFlagged = true
			break
		}
	}

	var update bson.M
	if isFlagged {
		// Remove user from flagged array
		update = bson.M{"$pull": bson.M{"flagged": userID}, "$set": bson.M{"updated_at": time.Now()}}
	} else {
		// Add user to flagged array
		update = bson.M{"$addToSet": bson.M{"flagged": userID}, "$set": bson.M{"updated_at": time.Now()}}
	}

	result, err := messageService.Collection.UpdateOne(messageService.ctx, filter, update)
	if err != nil {
		return nil, err
	}
	return result, nil
}

// GetLast50Messages returns the last 50 messages for a specific channel, starting from a given message ID
func GetMessages(limit int64, channel string, bookmarkID string) ([]MessageModel, string, bool, error) {

	filter := bson.M{
		"channel": channel,
	}

	// If bookmarkID is not the zero value, add it to the filter
	if bookmarkID != "" {
		filter["_id"] = bson.M{"$lt": bookmarkID} // Get messages with IDs less than the bookmark
	}

	opts := options.Find().SetLimit(limit + 1).SetSort(bson.M{"_id": -1}) // Sort by ID descending (newer first)

	cursor, err := messageService.Collection.Find(messageService.ctx, filter, opts)
	if err != nil {
		return nil, "", false, err
	}
	defer cursor.Close(messageService.ctx)

	var messages []MessageModel
	if err := cursor.All(messageService.ctx, &messages); err != nil {
		return nil, "", false, err
	}

	// Check if we fetched more than the limit
	hasMoreMessages := len(messages) > int(limit)

	// If there are more messages, remove the extra message from the result
	if hasMoreMessages {
		messages = messages[:limit]
	}

	// Get the last message's ID (bookmark ID)
	var lastMessageID string
	if len(messages) > 0 {
		lastMessageID = messages[0].Id.Hex()
	} else {
		lastMessageID = primitive.NilObjectID.Hex()
	}

	return messages, lastMessageID, hasMoreMessages, nil
}

func ListenChannel(channelId string) {

	// Define a match stage for filtering by channel
	matchStage := bson.D{{"$match", bson.D{
		{"fullDocument.channel", channelId}, // Match documents where the 'channel' field equals the provided channel name
	}}}

	// Define the pipeline with the match stage
	pipeline := mongo.Pipeline{matchStage}

	// Start the change stream
	changeStream, err := messageService.Collection.Watch(context.TODO(), pipeline)
	if err != nil {
		log.Fatalf("Error watching collection: %v", err)
	}
	defer changeStream.Close(context.TODO())

	fmt.Printf("Watching for changes in channel: %s\n", channelId)

	// Listen for changes
	for changeStream.Next(context.TODO()) {
		var event bson.M
		if err := changeStream.Decode(&event); err != nil {
			log.Errorf("Error decoding change stream event: %v", err)
		}

		// Process the change event (insert, update, delete, etc.)
		fmt.Printf("Received change event: %v\n", event)
		// Convert the map to JSON
		// jsonData, err := json.Marshal(event)
		// if err != nil {
		// 	fmt.Println(err)
		// 	return
		// }

		// // Print the JSON output
		// fmt.Printf("JSON Event -  %s\n", string(jsonData))

		operationType, ok := event["operationType"]
		if ok && operationType == "insert" {
			for _, userConn := range db.Connections {
				if doc, docExists := event["fullDocument"].(bson.M); docExists {
					if channel, channelExists := doc["channel"].(string); channelExists {
						if userConn.IsActive && userConn.ActiveSite == channel {
							log.Debug("userConn - ", userConn)
							userConn.Conn.WriteJSON(doc)
						}
					}
				}
			}
		}
		// err := user.Conn.WriteJSON(map[string]interface{}{
		// 	"MsgId":  message.ID,
		// 	"Values": message.Values,
		// })
		// if err != nil {
		// 	fmt.Printf("Error sending message to user %s: %v", user.UserId, err)
		// 	return
		// }
	}

	// Check for errors in the change stream
	if err := changeStream.Err(); err != nil {
		log.Fatalf("Change stream error: %v", err)
	}

}
