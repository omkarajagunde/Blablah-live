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
func AddRemoveReaction(messageID string, reactionKey string, userID string) (*mongo.UpdateResult, error) {

	// Convert the string to ObjectID
	objectID, stringToMongIDErr := primitive.ObjectIDFromHex(messageID)
	if stringToMongIDErr != nil {
		fmt.Println("Invalid ObjectID passed: ", stringToMongIDErr)
	}

	filter := bson.M{"_id": objectID}

	// Retrieve the current document to check the reaction state
	var message bson.M
	err := messageService.Collection.FindOne(messageService.ctx, filter).Decode(&message)
	if err != nil {
		return nil, err
	}

	// Check if the reaction array already exists
	reactions, ok := message["reactions"].(bson.M)
	if !ok {
		reactions = bson.M{}
	}

	// Get the current list of users for the given reactionKey
	userList, ok := reactions[reactionKey].([]interface{})
	if !ok {
		userList = []interface{}{}
	}

	// Flag to check if the user was already present
	userExists := false
	updatedUserList := []interface{}{}

	fmt.Printf("userList - %s\n", userList)

	// Check if the userID is already in the list and remove it if found
	for _, u := range userList {
		fmt.Printf("for - %s -- %s", u, userID)
		if u == userID {
			userExists = true // User exists, mark for removal
		} else {
			updatedUserList = append(updatedUserList, u) // Keep other users
		}
	}

	// If user is not found, add them to the list, otherwise they've been removed
	if !userExists {
		updatedUserList = append(updatedUserList, userID)
	}

	// Update the reactions map accordingly
	update := bson.M{}

	if len(updatedUserList) == 0 {
		// If no users are left for the reaction, remove the reaction from the map
		update = bson.M{
			"$unset": bson.M{"reactions." + reactionKey: ""},
			"$set":   bson.M{"updated_at": time.Now()},
		}
	} else {
		// Otherwise, update the reaction with the new user list
		update = bson.M{
			"$set": bson.M{
				"reactions." + reactionKey: updatedUserList,
				"updated_at":               time.Now(),
			},
		}
	}

	fmt.Printf("update -- %s\n updatedUserList - %s\n", update, updatedUserList)

	// Update the document in the database
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
		// Convert the string to ObjectID
		objectID, err := primitive.ObjectIDFromHex(bookmarkID)
		if err != nil {
			fmt.Println("Invalid ObjectID:", err)
		}
		filter["_id"] = bson.M{"$lt": objectID} // Get messages with IDs less than the bookmark
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
		lastMessageID = messages[len(messages)-1].Id.Hex()
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
	}

	// Check for errors in the change stream
	if err := changeStream.Err(); err != nil {
		log.Fatalf("Change stream error: %v", err)
	}

}
