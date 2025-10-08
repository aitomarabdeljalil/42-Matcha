.PHONY: up db down logs clean

up:
	docker compose up --build -d

setup:
	docker compose up -d postgres
	cd backend && npm i && npx prisma migrate reset -f

down:
	docker compose down --remove-orphans

logs:
	docker compose logs -f $(SERVICE)

clean: down
	@echo "Removing all containers..."
	-@docker rm $$(docker ps -aq) 2>/dev/null || true

	@echo "Removing all Docker images..."
	-@docker rmi $$(docker images -aq) 2>/dev/null || true

	@echo "Removing all Docker volumes..."
	-@docker volume rm $$(docker volume ls -q) 2>/dev/null || true

	@echo "Removing all Docker networks..."
	-@docker network rm $$(docker network ls -q) 2>/dev/null || true

	@echo "Removing generated folders"
	rm -rf server/node_modules