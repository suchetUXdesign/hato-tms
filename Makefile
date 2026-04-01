.PHONY: setup dev db-reset db-seed build clean

setup:
	./setup.sh

dev:
	npx concurrently --names "api,web" --prefix-colors "blue,green" \
		"npm run dev:api" \
		"npm run dev:web"

db-reset:
	npx prisma migrate reset --schema packages/db/prisma/schema.prisma --force

db-seed:
	npm run db:seed

build:
	npm run build

clean:
	rm -rf node_modules dist
	find . -name "node_modules" -type d -prune -exec rm -rf {} +
	find . -name "dist" -type d -prune -exec rm -rf {} +
	find . -name ".turbo" -type d -prune -exec rm -rf {} +
