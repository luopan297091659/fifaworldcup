# 后端接入方案

## 结论

可以和 JapaneseLearn 共用后端基础设施，但账号和业务数据必须按应用隔离。推荐第一阶段采用“共享服务 + 独立应用命名空间”的方式；只有在 JapaneseLearn 后端已经强绑定日语学习业务、没有通用登录/用户/权限模块时，才单独创建 WorldCup 服务端。

## 方案选择

### 方案 A：共用 JapaneseLearn 后端，推荐

适合条件：

- JapaneseLearn 已经有稳定的登录、用户表、接口鉴权、部署和日志能力。
- 后端可以新增应用维度字段，例如 `app_key`、`tenant_id` 或 `product_code`。
- 接口层可以按应用路由或模块拆分，例如 `/api/worldcup/*`。

需要添加：

- 应用配置：新增 `worldcup` 应用，配置小程序 `appid`、密钥、允许域名和回调配置。
- 账号隔离：登录态里写入 `app_key=worldcup`，所有用户查询必须带 `app_key` 或 `tenant_id`。
- 业务模块：新增比赛、预测、小组、排行榜、结算模块。
- 数据隔离：WorldCup 业务表独立建表，或所有共享表加应用隔离字段。

优点：

- 复用登录、部署、监控、后台管理和数据库连接。
- 上线速度快，后续也方便增加后台配置。

风险：

- 如果没有严格的应用隔离，JapaneseLearn 和 WorldCup 账号可能串数据。
- 后端发布节奏会互相影响，需要模块边界清晰。

### 方案 B：单独创建 WorldCup 服务端

适合条件：

- JapaneseLearn 后端只服务日语学习业务，改动成本高。
- WorldCup 需要独立部署、独立数据库、独立 SLA 或未来商业化策略不同。
- 账号体系不希望与 JapaneseLearn 有任何共享。

需要添加：

- 独立服务：`worldcup-api`。
- 独立数据库：只保存 WorldCup 用户、比赛、预测、小组、排行榜。
- 独立微信登录配置：小程序 `appid` 对应自己的登录和 session。
- 独立定时任务：拉取赛程、赛果并结算。

优点：

- 边界最清晰，账号天然隔离。
- 后续迁移、扩展、下线互不影响。

风险：

- 初期开发和维护成本更高。
- 登录、鉴权、后台、监控都要重复建设。

## 账号隔离设计

无论共用还是单独服务，都不要直接用昵称或客户端传入的用户 ID 识别用户。建议使用以下结构：

### 账号表

`accounts`

| 字段 | 说明 |
| --- | --- |
| `id` | 账号记录 ID |
| `app_key` | 应用标识，WorldCup 固定为 `worldcup` |
| `provider` | 登录来源，例如 `wechat_miniprogram` |
| `provider_appid` | 当前小程序 appid |
| `provider_openid` | 微信 openid |
| `unionid` | 可选，仅用于未来显式账号合并 |
| `user_id` | 当前应用内用户 ID |
| `created_at` | 创建时间 |

唯一约束：

- `unique(app_key, provider, provider_appid, provider_openid)`

这样 JapaneseLearn 和 WorldCup 即使共用同一个数据库，也不会因为同一个微信用户或同名昵称混到同一个业务账号里。

### 用户表

`users`

| 字段 | 说明 |
| --- | --- |
| `id` | 用户 ID |
| `app_key` | 固定为 `worldcup` |
| `display_name` | 展示昵称 |
| `avatar_url` | 头像 |
| `score` | 总积分 |
| `ai_wins` | 战胜 AI 次数 |
| `title` | 称号 |
| `created_at` | 创建时间 |
| `updated_at` | 更新时间 |

所有 WorldCup 查询都必须带：

```text
where app_key = "worldcup"
```

## WorldCup 业务表

第一阶段建议新增这些表：

- `worldcup_matches`：比赛、开赛时间、状态、赛果、AI 参考。
- `worldcup_match_lineups`：比赛首发阵容、球员位置、数据源版本、更新时间。
- `worldcup_predictions`：用户预测、信心值、提交时间、得分。
- `worldcup_rooms`：小组名、类型、热度、助威数。
- `worldcup_room_members`：小组成员关系。
- `worldcup_rankings`：预计算排行榜。

如果后端规范不喜欢业务前缀，也可以使用 `matches`、`predictions` 等表名，但必须包含 `app_key` 字段和查询约束。

## 小程序需要新增的接口

当前小程序还在使用 `utils/mockData.js` 和 `wx.setStorageSync("worldcup_state")`。正式接后端时建议先加一层 API 适配，不要让页面直接关心后端实现。

建议新增 `utils/api.js`：

```js
const APP_KEY = "worldcup";

function callApi(name, data = {}) {
  return wx.cloud.callFunction({
    name,
    data: {
      appKey: APP_KEY,
      ...data
    }
  });
}

module.exports = {
  login: () => callApi("worldcupLogin"),
  getHome: () => callApi("worldcupGetHome"),
  submitPrediction: (payload) => callApi("worldcupSubmitPrediction", payload),
  cheerRoom: (roomId) => callApi("worldcupCheerRoom", { roomId }),
  getRanking: (scope) => callApi("worldcupGetRanking", { scope }),
  getProfile: () => callApi("worldcupGetProfile")
};
```

页面替换顺序：

1. `app.js`：启动时调用 `login()`，拿到当前 WorldCup 用户。
2. `pages/home/home.js`：用 `getHome()` 替换本地 `state.matches`、`state.rooms`。
3. `pages/predict/predict.js`：用 `submitPrediction()` 替换本地写入 `state.predictions`。
4. `pages/room/room.js`：用 `cheerRoom()` 替换本地助威计数。
5. `pages/ranking/ranking.js`：用 `getRanking(scope)` 替换本地排序。
6. `pages/profile/profile.js`：用 `getProfile()` 替换本地统计。

## 后端接口清单

### `worldcupLogin`

职责：

- 校验微信登录态。
- 根据 `app_key + provider_appid + openid` 查找或创建账号。
- 返回当前 WorldCup 用户资料。

返回：

```json
{
  "user": {
    "id": "u_xxx",
    "displayName": "我",
    "score": 0,
    "aiWins": 0,
    "title": "稳健预言家"
  }
}
```

### `worldcupGetHome`

职责：

- 返回近期比赛。
- 返回我的预测状态。
- 返回推荐小组和我的小组排名。

### `worldcupSubmitPrediction`

职责：

- 服务端校验比赛是否还可预测。
- 保存或更新预测。
- 保存 `firstScorer` 和 `firstScorerSource`，其中 `firstScorerSource=lineup` 表示来自首发阵容选择，`manual` 表示用户手动填写。
- 截止后禁止修改。
- 返回 AI 参考和最新用户统计。

### `worldcupGetMatchDetail`

职责：

- 返回单场比赛最新状态、AI 参考、用户已提交预测。
- 返回两队最新首发阵容，字段建议为 `lineups.home` 和 `lineups.away`。
- 阵容临近开赛可能频繁调整，接口不要依赖客户端缓存；客户端进入预测页、点击同步、提交预测前都会重新拉取。
- 当请求参数 `refreshLineup=true` 时，服务端应优先检查上游阵容源或读取最新缓存，再返回给客户端。

返回示例：

```json
{
  "match": {
    "id": "m1",
    "home": "墨西哥",
    "away": "南非",
    "status": "open",
    "lineupUpdatedAt": "06月12日 02:55",
    "lineups": {
      "home": [
        { "id": "mex-1", "name": "希门尼斯", "position": "前锋", "status": "starter" }
      ],
      "away": [
        { "id": "rsa-1", "name": "福斯特", "position": "前锋", "status": "starter" }
      ]
    }
  },
  "prediction": null
}
```

### `worldcupSyncLineups`

职责：

- 从第三方世界杯数据源同步实际首发阵容，不由客户端直接访问第三方接口。
- 赛前 24 小时内每 1 小时同步一次阵容。
- 赛前 2 小时内建议加密到每 10-15 分钟同步一次，因为正式首发通常在临近开赛才确认。
- 开赛后停止改写首发阵容，保留最后确认版本，用于首球球员校验和赛后复盘。
- 同步失败时保留上一版阵容，并记录 `lineupSyncStatus=stale`，客户端仍可展示旧阵容和允许手动填写。

推荐调度：

| 比赛阶段 | 同步频率 | 说明 |
| --- | --- | --- |
| 开赛前 7 天到 24 小时 | 每 6 小时 | 主要同步候选阵容、伤停和名单状态 |
| 开赛前 24 小时到 2 小时 | 每 1 小时 | 满足赛前一天阵容及时更新需求 |
| 开赛前 2 小时到开赛 | 每 10-15 分钟 | 捕捉官方首发确认和临场变更 |
| 开赛后 | 停止首发更新 | 阵容版本封存，避免影响已提交预测 |

`worldcup_match_lineups` 建议字段：

| 字段 | 说明 |
| --- | --- |
| `match_id` | 比赛 ID |
| `team_side` | `home` 或 `away` |
| `team_name` | 球队名 |
| `player_id` | 数据源球员 ID |
| `name` | 球员展示名 |
| `position` | 位置 |
| `status` | `starter`、`bench`、`doubtful`、`unavailable` |
| `source` | 数据来源 |
| `source_version` | 数据源版本或更新时间戳 |
| `updated_at` | 本地更新时间 |

### `worldcupCheerRoom`

职责：

- 增加小组助威数。
- 做简单频控，避免重复刷。

### `worldcupGetRanking`

职责：

- 根据 `scope` 返回好友、小组、全球、公司、留学生榜。
- 排行数据建议从 `worldcup_rankings` 读取，减少实时聚合压力。

### `worldcupSettleMatches`

职责：

- 定时拉取赛果。
- 计算预测得分。
- 更新用户积分和排行榜。

## 添加步骤

1. 确认 JapaneseLearn 后端是否有通用登录和用户模块。
2. 如果有，新增 `worldcup` 应用配置，并给账号表加唯一约束 `app_key + provider + provider_appid + provider_openid`。
3. 新增 WorldCup 业务表和云函数/接口。
4. 小程序增加 `utils/api.js`，先保留 mock 作为 fallback。
5. 按页面逐步替换本地状态读写。
6. 接入定时结算任务和排行榜预计算。
7. 上线前压测账号隔离：同一微信用户登录 JapaneseLearn 和 WorldCup，必须产生两个应用内账号；WorldCup 接口不能读到 JapaneseLearn 数据。

## 推荐落地顺序

第一阶段先共用 JapaneseLearn 后端，但只复用基础设施和登录能力，不复用业务用户身份。WorldCup 内部用户 ID 独立生成，后续如果想做跨产品账号体系，再通过 `unionid` 做用户主动授权后的账号绑定。
