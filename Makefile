.PHONY: restart
restart:
	docker-compose down --remove-orphans
	sudo rm -fr .data
	yarn codegen
	yarn build
	docker-compose up -d
	docker-compose logs -f
