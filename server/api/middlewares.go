package api

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/limiter"
)

func RateLimit(count int, duration time.Duration) fiber.Handler {

	if duration == 0 {
		duration = time.Minute // Default to x requests per minute
	}
	return limiter.New(limiter.Config{
		Max:        count,
		Expiration: duration,
		KeyGenerator: func(c *fiber.Ctx) string {
			return c.IP() + "_" + c.Path() // Limit each IP to a unique request per path
		},
		LimitReached: func(ctx *fiber.Ctx) error {
			// Return a JSON response when rate limit is reached
			return ctx.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"error":   "Too many requests",
				"message": "Please wait before trying again.",
				"status":  fiber.StatusTooManyRequests,
			})
		},
		SkipFailedRequests:     false,
		SkipSuccessfulRequests: false,
	})
}
