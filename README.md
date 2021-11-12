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
        "image": string
    }>
}
```

## addon
