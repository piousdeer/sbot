# sbot
Нескучный дискорд-бот.

## Как запустить на своём токене

1. Клонируем репу `git clone https://github.com/piousdeer/sbot`
2. Заходим в корень `cd sbot`
3. Создаём файл `.env`:
```
BOT_TOKEN=ваш_токен
# не секрет!!! находится во вкладке Bots

IMGUR_ID=ваш_имгур_айди
# для отправки пикч на Имгур, сейчас не используется

OWNER_ID=ваш_личный_дискорд_айди
# чтобы бот понимал, что вы - его владелец

BOT_SHORT_NAME=sb
# какое имя будет отображаться в статусе

ACCEPTABLE_BOT_NICKNAME=ыи|c,|[сcs][бb6]|сбот|стилл?бот|sbot|still?bot
# на что бот может откликаться
```

### Через докер
4. Устанавливаем Docker (на арче и манжаро `sudo pacman -S docker`, `sudo systemctl enable --now docker`, на винде найдете сами)
5. Билдим имаж `docker build . --tag sbot`
6. Запускаем `docker run --env-file=.env --memory=1G --interactive --tty --rm sbot`

Можно последние три флага заменить на `--name=sbot --detach --restart=unless-stopped`, чтобы бот работал в бэкграунде и стартовал автоматически при запуске системы.

При изменениях в коде повторять шаги 5 и 6.

### По классике
4. Устанавливаем nodejs версии 12 (модуль canvas ломается на более поздних версиях), наиболее удобно это сделать через nvm: `nvm install 12`
(nvm на винде удобно поставить через [scoop](https://scoop.sh/), на линуксах найдете сами)
5. Ставим зависимости `npm install`
6. Запускаем `npm start`
