# 刷新后自动恢复登录状态

## Why
目前用户登录后刷新页面会被要求重新登录。原因是 `authManager.init()` 虽然成功恢复了 Supabase 的 session，但查询 `public.users` 表获取用户 profile 时可能失败（触发器未创建用户行、RLS 阻止等），此时 `this.currentUser` 保持 null，导致 `isLoggedIn()` 返回 false，界面判定用户未登录。

## Current State Analysis

[session 恢复流程](file:///workspace/src/js/auth.js#L7-L36)
```
App.init()
  → authManager.init()
    → supabase.auth.getSession()         ✅ 成功：从 Supabase SDK localStorage 恢复
    → supabase.auth.getUser()            ✅ 成功：拿到 auth user
    → supabase.from('users').select()    ❌ 可能失败：public.users 表无此用户行
    → this.currentUser = null            → isLoggedIn() = false → 显示登录页
```

对比 `register()` 和 `login()` 方法（第 83-89 行、127-131 行），它们都有 fallback：
```javascript
if (!profileError && profile) {
    this.currentUser = profile;
} else {
    this.currentUser = { id: data.user.id, username: username };
}
```

但 `init()` 没有这个 fallback，profile 查询失败时 `this.currentUser` 就是 null。

## Proposed Changes

### 修改 `authManager.init()` 增加 fallback

**文件**: [auth.js](file:///workspace/src/js/auth.js) 第 7-36 行

**变更**: profile 查询失败时，用 auth user 的 metadata 构造 `currentUser` 兜底，确保 `isLoggedIn()` 返回 true。

```javascript
// 修改前（第 22-30 行）
const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

if (!profileError && profile) {
    this.currentUser = profile;
}

// 修改后
const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

if (!profileError && profile) {
    this.currentUser = profile;
} else if (user) {
    this.currentUser = {
        id: user.id,
        username: user.user_metadata?.username || user.email?.split('@')[0] || ''
    };
    console.warn('用户 profile 未找到，使用 auth metadata 兜底');
}
```

## Assumptions & Decisions
- Supabase SDK 的 `getSession()` 本身就能正确从 localStorage 恢复 session，无需额外存储
- auth user 的 `user_metadata.username` 在注册时通过 `options.data.username` 设置，前端可读取
- 不需要引入额外的 cookie 方案或自定义 token 存储

## Verification
1. 用户登录后刷新页面 → 不再显示登录页，直接进入主界面
2. 开发者工具 Application → Local Storage 中有 `supabase.auth.token` 项
3. 浏览器 Console 无报错（如出现 `console.warn` 说明走兜底逻辑，功能正常但 profile 表需排查）