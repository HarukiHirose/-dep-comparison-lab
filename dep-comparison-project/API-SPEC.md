# API仕様(両アプリ共通)

両アプリはこのAPIを同一の入出力で実装する。これが「機能的に等価」であることの根拠になる。

## POST /api/register
body: `{ "email": string, "password": string(8文字以上) }`
成功: 201 `{ "id": string, "email": string }`
失敗: 400 `{ "error": string }` / 409 email重複

## POST /api/login
body: `{ "email": string, "password": string }`
成功: 200 `{ "token": string }`
失敗: 401 `{ "error": "invalid credentials" }`

## GET /api/tasks
header: `Authorization: Bearer <token>`
成功: 200 `[{ "id": string, "title": string, "done": boolean, "createdAt": string }]`

## POST /api/tasks
header: `Authorization: Bearer <token>`
body: `{ "title": string(1〜200文字) }`
成功: 201 `{ "id": string, "title": string, "done": false, "createdAt": string }`

## PATCH /api/tasks/:id
header: `Authorization: Bearer <token>`
body: `{ "title"?: string, "done"?: boolean }`
成功: 200 更新後のタスク
失敗: 404(存在しない/他人のタスク)

## DELETE /api/tasks/:id
header: `Authorization: Bearer <token>`
成功: 204
失敗: 404
