# discord-terminal
Run linux commands with discord

# Config
`config.json`
```ts
{
    "token": string, //your token here
    "hostname": string,
    "commandPrefix": string,
    "terminalName": string,
    "terminalChannel": Array<{
        "user": string,
        "id": string
    }>
    "containers": Array<{
        "name": string,
        "port": number,
        "image": string,
        "dockerConfig": Object<dockerConfig>, //The option to create container. See https://docs.docker.com/engine/api/v1.37/#operation/ContainerCreate
        "discordIcon": string //Example: "<:windows:762682464966803476>"
        "authMethod": {
            "type": string,
            "user": string,
            "password": string
        }
    }>
}
```

## addon
