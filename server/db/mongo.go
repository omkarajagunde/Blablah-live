package db

import (
	"context"
	"os"

	"github.com/gofiber/fiber/v2/log"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var (
	mongoCtx                 = context.TODO()
	db       *mongo.Database = nil
)

func MongoInit(colName string) (*mongo.Collection, context.Context) {

	if db != nil {
		log.Info("Connected to collection - ", colName)
		return db.Collection(colName), mongoCtx
	}

	clientOptions := options.Client().ApplyURI(os.Getenv("MONGO_URL"))
	client, err := mongo.Connect(mongoCtx, clientOptions)
	if err != nil {
		log.Fatal(err)
	}

	err = client.Ping(mongoCtx, nil)
	if err != nil {
		log.Fatal(err)
	}

	db = client.Database(os.Getenv("MONGO_DB_NAME"))
	log.Info("Connected to collection - ", colName)
	return db.Collection(colName), mongoCtx
}
