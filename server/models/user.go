package models

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/brianvoe/gofakeit/v6"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/log"
	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"

	C "server/constants"
	"server/utils"
)

type Flagged struct {
	Who        string
	Whom       string
	ReasonCode string
}

// User data representation
type UserModel struct {
	Id            string    `bson:"_id"`
	Username      string    `bson:"username"`
	Ip            string    `bson:"ip"`
	IsOnline      bool      `bson:"is_online"`
	ExploredSites []string  `bson:"explored_sites"`
	ActiveSite    string    `bson:"active_site"`
	Flagged       []Flagged `bson:"flagged"`
	IsLoggedIn    bool      `bson:"is_logged_in"`
	LoginMethod   string    `bson:"login_method"` // <custom, google>,
	IsBanned      bool      `bson:"is_banned"`
	CreatedAt     time.Time `bson:"created_at"`
	ModifiedAt    time.Time `bson:"modified_at"`
	City          string    `bson:"city"`
	Country       string    `bson:"country"`
	Region        string    `bson:"region"`
	Coords        string    `bson:"coords"`
}

type UserService struct {
	Collection *mongo.Collection
	ctx        context.Context
}

var userService UserService

func CreateUserService(collection *mongo.Collection, ctx context.Context) {
	userService = UserService{Collection: collection, ctx: ctx}
}

func NewUser(ctx *fiber.Ctx) (*UserModel, bool) {

	username := gofakeit.Gamertag()
	ipUrl := strings.Replace(C.IP_INFO_URL, "REPLACE_IP_HERE", ctx.IP(), 1)

	var str []byte
	res, err := http.Get(ipUrl)
	if err != nil {
		log.Error(err.Error())
		str = []byte("{}")
	}

	defer res.Body.Close()
	str, readErr := io.ReadAll(res.Body)
	if readErr != nil {
		log.Error(err.Error())
	}

	// Convert string to map
	ipinfoMap, err := utils.Convert_JSONStringToMap(string(str))
	if err != nil {
		log.Error("Error:", err, ipinfoMap)
		ipinfoMap = map[string]string{}
	}

	// Get SiteId from Query params
	siteId := ctx.Query("SiteId", "USER_NOT_IN_PLUGIN")
	userId := uuid.New().String()

	user := &UserModel{
		Id:            userId,
		Username:      username,
		Ip:            ctx.IP(),
		IsOnline:      true,
		ExploredSites: []string{siteId},
		ActiveSite:    siteId,
		Flagged:       []Flagged{},
		IsLoggedIn:    false,
		LoginMethod:   "",
		IsBanned:      false,
		CreatedAt:     time.Now(),
		ModifiedAt:    time.Now(),
		City:          utils.GetJSONValue(ipinfoMap.(map[string]interface{}), "city"),
		Country:       utils.GetJSONValue(ipinfoMap.(map[string]interface{}), "country"),
		Region:        utils.GetJSONValue(ipinfoMap.(map[string]interface{}), "region"),
		Coords:        utils.GetJSONValue(ipinfoMap.(map[string]interface{}), "loc"),
	}

	_, insertError := userService.Collection.InsertOne(userService.ctx, user)
	if insertError != nil {
		log.Error("Error while creating new user in mongo: ", err)
		return nil, false
	}
	log.Info("New user added to mongo by id: ", userId)
	return user, true

}

func GetUser(userId string) (*UserModel, bool) {

	filter := bson.M{"_id": userId}

	var user UserModel
	err := userService.Collection.FindOne(userService.ctx, filter).Decode(&user)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			log.Error("no user found with id:", userId)
		} else {
			log.Error(err)
		}

		return nil, true
	}

	return &user, false

}

func UpdateUser(userId string, mp bson.M) error {

	filter := bson.M{"_id": userId}
	update := bson.M{
		"$set": mp,
	}

	_, err := userService.Collection.UpdateOne(userService.ctx, filter, update)
	if err != nil {
		return fmt.Errorf("UpdateOneErr: %s :: %s", userId, err)
	}
	return nil

}
