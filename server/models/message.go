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
	Flagged   map[string]interface{} `json:"flagged"`
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

	return result.InsertedID
}

// Report message
func ReportMessage(messageID string, userID string) (*mongo.UpdateResult, error) {
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
	reactions, ok := message["flagged"]
	if !ok {
		reactions = bson.M{}
	}

	// Get the current list of users for the given reactionKey
	userList, ok := reactions.(bson.M)["FLAG_CODE_1"]
	if !ok {
		userList = primitive.A{}
	}

	// Flag to check if the user was already present
	userExists := false
	updatedUserList := []string{}

	// Check if the userID is already in the list and remove it if found
	for _, u := range userList.(primitive.A) {
		if u.(string) == userID {
			userExists = true // User exists, mark for removal
		} else {
			updatedUserList = append(updatedUserList, u.(string)) // Keep other users
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
			"$unset": bson.M{"flagged.FLAG_CODE_1": ""},
			"$set":   bson.M{"updated_at": time.Now()},
		}
	} else {
		// Otherwise, update the reaction with the new user list
		update = bson.M{
			"$set": bson.M{
				"flagged.FLAG_CODE_1": updatedUserList,
				"updated_at":          time.Now(),
			},
		}
	}

	// Update the document in the database
	result, err := messageService.Collection.UpdateOne(messageService.ctx, filter, update)
	if err != nil {
		return nil, err
	}

	return result, nil
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
	reactions, ok := message["reactions"]
	if !ok {
		reactions = bson.M{}
	}

	// Get the current list of users for the given reactionKey
	userList, ok := reactions.(bson.M)[reactionKey]
	if !ok {
		userList = primitive.A{}
	}

	// Flag to check if the user was already present
	userExists := false
	updatedUserList := []string{}

	// Check if the userID is already in the list and remove it if found
	for _, u := range userList.(primitive.A) {
		if u.(string) == userID {
			userExists = true // User exists, mark for removal
		} else {
			updatedUserList = append(updatedUserList, u.(string)) // Keep other users
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

	// Update the document in the database
	result, err := messageService.Collection.UpdateOne(messageService.ctx, filter, update)
	if err != nil {
		return nil, err
	}

	return result, nil
}

func GetSingleMessage(id string, siteId string) (MessageModel, bool) {
	filter := bson.M{
		"channel": siteId,
	}

	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		fmt.Println("Invalid ObjectID:", err)
	}
	filter["_id"] = objectID

	var message MessageModel
	err = messageService.Collection.FindOne(messageService.ctx, filter).Decode(&message)
	if err != nil {
		log.Fatal("Message not found:", err)
		return message, false
	}

	// Print the result
	fmt.Println("Message found:", id)
	return message, true
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

func ListenAllChanges() {

	// Define the options for the change stream
	options := options.ChangeStream().SetFullDocument(options.UpdateLookup) // Retrieve the full document

	// Define the pipeline without any filters to capture all changes
	pipeline := mongo.Pipeline{}

	// Start the change stream
	changeStream, err := messageService.Collection.Watch(context.TODO(), pipeline, options)
	if err != nil {
		log.Fatalf("Error watching collection: %v", err)
	}
	defer changeStream.Close(context.TODO())

	fmt.Println("Watching for all changes in the collection...")

	// Listen for changes
	for changeStream.Next(context.TODO()) {
		var event bson.M
		if err := changeStream.Decode(&event); err != nil {
			log.Errorf("Error decoding change stream event: %v", err)
			continue
		}

		// Process the change event (insert, update, delete, etc.)
		// fmt.Printf("Received change event: %v\n", event)

		operationType, ok := event["operationType"]
		if ok {
			switch operationType {
			case "insert":
				// fmt.Println("An insert operation occurred.", event)
				for _, userConn := range db.Connections {
					if doc, docExists := event["fullDocument"].(bson.M); docExists {
						if channel, channelExists := doc["channel"].(string); channelExists {
							if userConn.IsActive && userConn.ActiveSite == channel {
								userConn.Channel <- map[string]interface{}{
									"doc":  doc,
									"type": "insert",
								}
							}
						}
					}
				}
			case "update":
				// fmt.Println("An update operation occurred.", event)
				for _, userConn := range db.Connections {
					if doc, docExists := event["fullDocument"].(bson.M); docExists {
						if channel, channelExists := doc["channel"].(string); channelExists {
							if userConn.IsActive && userConn.ActiveSite == channel {
								userConn.Channel <- map[string]interface{}{
									"doc":  doc,
									"type": "update",
								}
							}
						}
					}
				}
			case "delete":
				fmt.Println("A delete operation occurred.", event)
				// Handle delete logic here
			default:
				fmt.Printf("Other operation: %v\n", operationType)
			}
		}
	}

	// Check for errors in the change stream
	if err := changeStream.Err(); err != nil {
		log.Fatalf("Change stream error: %v", err)
	}
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

		operationType, ok := event["operationType"].(string)
		if ok {
			switch operationType {
			case "insert":
				for _, userConn := range db.Connections {
					if doc, docExists := event["fullDocument"].(bson.M); docExists {
						if channel, channelExists := doc["channel"].(string); channelExists {
							if userConn.IsActive && userConn.ActiveSite == channel {
								userConn.Channel <- doc
							}
						}
					}
				}
			case "update":
				fmt.Printf("Update event: %v\n", event)
			case "delete":
				//
			default:
				log.Debugf("Unhandled operation type: %s", operationType)
			}
		}

	}

	// Check for errors in the change stream
	if err := changeStream.Err(); err != nil {
		log.Fatalf("Change stream error: %v", err)
	}

}
