CREATE TABLE `weather_cache` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`fetched_at` text NOT NULL,
	`current_temp` real NOT NULL,
	`current_weather_code` integer NOT NULL,
	`current_wind_speed` real NOT NULL,
	`today_high` real NOT NULL,
	`today_low` real NOT NULL,
	`forecast_json` text NOT NULL,
	CONSTRAINT "weather_cache_singleton" CHECK("weather_cache"."id" = 1)
);
