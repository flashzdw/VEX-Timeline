# Supabase 用户登录与云端时间轴共享 Spec

## Why
当前 VEX-Timeline 仅使用 IndexedDB 本地存储数据，无法跨设备同步，也无法多人协作。通过引入 Supabase，实现用户登录、云端保存和团队时间轴共享，让选手可以在多设备访问自己的备赛记录，并与赛队成员共享时间轴。

## What Changes
- 新增 Supabase 客户端集成，作为后端服务
- 新增用户注册/登录系统（仅用户名，无密码/邮箱验证）
- 新增云端数据存储，将个人时间轴记录同步至 Supabase
- 新增赛队时间轴功能，支持创建、邀请、权限管理
- **BREAKING** 数据存储从纯 IndexedDB 迁移为 Supabase 优先 + IndexedDB 离线缓存
- 修改现有 App 类，增加登录状态管理和时间轴切换逻辑

## Impact
- Affected specs: 原始 spec 中的 Non-Goals（云端同步、团队协作）现在变为 In-Scope
- Affected code:
  - `src/js/db.js` — 需要扩展为同时支持 IndexedDB 和 Supabase
  - `src/js/app.js` — 需要增加登录/注册 UI、时间轴切换、邀请管理逻辑
  - `index.html` — 需要增加登录/注册页面、时间轴选择器、邀请相关 UI
  - `src/css/styles.css` — 需要增加新 UI 组件样式
  - 新增 `src/js/supabase.js` — Supabase 客户端初始化与 API 封装
  - 新增 `src/js/auth.js` — 用户认证逻辑
  - 新增 `src/js/cloud-db.js` — 云端数据库操作封装

## ADDED Requirements

### Requirement: 用户注册与登录
系统 SHALL 提供仅基于用户名的注册和登录功能，无需密码、邮箱或其他验证信息。

#### Scenario: 新用户注册
- **WHEN** 用户输入一个未被占用的用户名并点击注册
- **THEN** 系统创建该用户，自动登录，并跳转到个人时间轴

#### Scenario: 用户名已存在
- **WHEN** 用户输入一个已被占用的用户名并点击注册
- **THEN** 系统提示"用户名已被占用"，不创建用户

#### Scenario: 已有用户登录
- **WHEN** 用户输入已存在的用户名并点击登录
- **THEN** 系统验证用户存在后自动登录，跳转到个人时间轴

#### Scenario: 登录用户名不存在
- **WHEN** 用户输入不存在的用户名并点击登录
- **THEN** 系统提示"用户名不存在"

#### Scenario: 保持登录状态
- **WHEN** 用户成功登录后关闭浏览器再重新打开
- **THEN** 系统自动恢复登录状态，无需重新登录

### Requirement: 个人时间轴云端保存
系统 SHALL 将登录用户的个人时间轴记录保存至 Supabase 云端，实现跨设备数据同步。

#### Scenario: 添加记录后云端同步
- **WHEN** 登录用户添加一条新记录
- **THEN** 记录同时保存到 IndexedDB 本地缓存和 Supabase 云端

#### Scenario: 跨设备访问
- **WHEN** 用户在设备 A 添加记录后，在设备 B 登录同一账号
- **THEN** 设备 B 能看到设备 A 添加的记录

#### Scenario: 离线使用
- **WHEN** 用户在无网络环境下操作
- **THEN** 记录保存到 IndexedDB 本地，网络恢复后自动同步到云端

### Requirement: 赛队时间轴创建
系统 SHALL 允许登录用户创建赛队时间轴，创建者自动成为该时间轴的所有者。

#### Scenario: 创建赛队时间轴
- **WHEN** 用户点击创建赛队时间轴并输入名称
- **THEN** 系统创建赛队时间轴，创建者拥有所有者权限

#### Scenario: 查看自己的时间轴列表
- **WHEN** 登录用户查看时间轴列表
- **THEN** 显示个人时间轴和所有已加入的赛队时间轴

### Requirement: 赛队时间轴邀请
系统 SHALL 支持赛队时间轴所有者通过邀请制让其他用户获得访问权限。

#### Scenario: 生成邀请
- **WHEN** 赛队时间轴所有者点击邀请按钮
- **THEN** 系统生成一个邀请码（或邀请链接）

#### Scenario: 使用邀请码加入
- **WHEN** 其他用户输入有效的邀请码
- **THEN** 该用户获得该赛队时间轴的访问权限（成员角色）

#### Scenario: 邀请码无效
- **WHEN** 用户输入无效或过期的邀请码
- **THEN** 系统提示"邀请码无效"

#### Scenario: 成员访问赛队时间轴
- **WHEN** 被邀请的成员切换到该赛队时间轴
- **THEN** 可以查看和添加记录，但不能删除其他成员的记录

#### Scenario: 所有者管理成员
- **WHEN** 赛队时间轴所有者查看成员列表
- **THEN** 可以移除成员、查看邀请码

### Requirement: 时间轴切换
系统 SHALL 提供时间轴切换功能，让用户在个人时间轴和赛队时间轴之间切换。

#### Scenario: 切换时间轴
- **WHEN** 用户从时间轴选择器选择不同的时间轴
- **THEN** 界面切换到对应时间轴的记录视图

#### Scenario: 未登录状态
- **WHEN** 用户未登录
- **THEN** 仅显示本地 IndexedDB 中的记录，不提供云端功能

## MODIFIED Requirements

### Requirement: 数据存储策略
原要求"数据本地存储，无需后端服务"修改为：
- 登录用户：数据优先保存至 Supabase 云端，IndexedDB 作为离线缓存
- 未登录用户：数据仅保存至 IndexedDB 本地（保持原有行为）
- 云端数据与本地缓存通过时间戳进行增量同步

### Requirement: PWA 离线支持
原 NFR-5 "无网络时仍可正常使用所有功能"修改为：
- 未登录状态：所有功能离线可用（保持原有行为）
- 登录状态：核心功能（查看、添加、编辑、删除记录）离线可用，网络恢复后自动同步；邀请管理等功能需要网络

## REMOVED Requirements

### Requirement: 纯前端无后端约束
**Reason**: 引入 Supabase 作为后端服务
**Migration**: Supabase 提供免费层，无需自建后端；前端仍为 SPA，Supabase 通过 REST API 交互

## Supabase 数据库设计

### 表结构

**users**
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid (PK) | Supabase auth uid |
| username | text (UNIQUE) | 用户名 |
| created_at | timestamptz | 创建时间 |

**timelines**
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid (PK) | 时间轴 ID |
| name | text | 时间轴名称 |
| type | text | 'personal' 或 'team' |
| owner_id | uuid (FK → users) | 所有者 |
| invite_code | text | 邀请码（仅 team 类型） |
| created_at | timestamptz | 创建时间 |

**timeline_members**
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid (PK) | 成员关系 ID |
| timeline_id | uuid (FK → timelines) | 时间轴 |
| user_id | uuid (FK → users) | 用户 |
| role | text | 'owner' 或 'member' |
| joined_at | timestamptz | 加入时间 |

**records**
| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid (PK) | 记录 ID |
| timeline_id | uuid (FK → timelines) | 所属时间轴 |
| user_id | uuid (FK → users) | 创建者 |
| date | date | 日期 |
| time | text | 时间 |
| title | text | 标题 |
| content | text | 内容 |
| importance | text | 重要性 high/medium/low |
| image_url | text | 图片 URL（Supabase Storage） |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

### Row Level Security (RLS) 策略
- **users**: 用户只能读取自己的数据
- **timelines**: 所有者可读写；成员可读取
- **timeline_members**: 时间轴所有者可管理成员；成员可读取
- **records**: 时间轴成员可创建和读取；只有记录创建者可编辑/删除自己的记录；所有者可删除任意记录

## 技术方案

### 认证方案
使用 Supabase Auth 的匿名登录（`signInAnonymously`）+ 自定义 `users` 表存储用户名。注册流程：
1. 调用 `supabase.auth.signInAnonymously()` 创建匿名用户
2. 在 `users` 表插入 username 记录
3. 登录时通过 username 查询 `users` 表获取 auth uid，然后用 `supabase.auth.signInWithPassword` 或通过自定义 token 恢复会话

**简化方案**：由于只需用户名无需密码，采用自定义认证：
1. 注册：调用 Supabase RPC 函数 `register(username)` → 内部创建 auth 用户并关联 username
2. 登录：调用 Supabase RPC 函数 `login(username)` → 返回自定义 token，前端用 `supabase.auth.setSession` 恢复

### 邀请码方案
- 生成 6 位随机字母数字组合作为邀请码
- 存储在 `timelines.invite_code` 字段
- 用户输入邀请码后查询 `timelines` 表匹配，匹配成功则插入 `timeline_members` 记录

### 图片存储方案
- 图片上传至 Supabase Storage bucket `record-images`
- 记录中存储 `image_url` 为 Storage 的公开 URL
- 本地缓存使用 IndexedDB 存储 base64 数据
