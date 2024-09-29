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
	Id string `bson:"_id"`

	Username      string    `bson:"username"`
	Avatar        string    `bson:"avatar"`
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

func get(tag string, url string, result chan map[string]string) {
	// Call GET API
	res, err := http.Get(url)
	if err != nil {
		log.Error(err.Error())
		result <- map[string]string{
			"tag":   tag,
			"value": "{}",
		}
	}

	// Decode the retrived profile pic
	defer res.Body.Close()
	str, readErr := io.ReadAll(res.Body)
	if readErr != nil {
		log.Error(err.Error())
	}

	result <- map[string]string{
		"tag":   tag,
		"value": string(str),
	}
}

func NewUser(ctx *fiber.Ctx) (*UserModel, bool) {

	ch := make(chan map[string]string)
	defer close(ch)

	username := gofakeit.Gamertag()
	avatarUrl := strings.Replace(C.AVATAR_GENERATOR_URL, "REPLACE_SEED_HERE", username, 1)
	ipUrl := strings.Replace(C.IP_INFO_URL, "REPLACE_IP_HERE", ctx.IP(), 1)

	go get("svg", avatarUrl, ch)
	go get("ipinfo", ipUrl, ch)

	result := map[string]string{}
	temp := <-ch
	result[temp["tag"]] = temp["value"]
	temp = <-ch
	result[temp["tag"]] = temp["value"]

	// Convert string to map
	ipinfoMap, err := utils.Convert_JSONStringToMap(result["ipinfo"])
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
		Avatar:        result["svg"],
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
		log.Error("Error while creating new user in redis: ", err)
		return nil, false
	}
	log.Info("New user added to redis by id: ", userId)
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
