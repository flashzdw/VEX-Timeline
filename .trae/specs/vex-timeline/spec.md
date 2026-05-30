# VEX-Timeline - Product Requirement Document

## Overview
- **Summary**: VEX-Timeline是一个PWA应用，帮助VEX选手记录备赛和比赛过程中每一天的活动，以简洁的时间轴形式呈现。采用Nothing设计风格，白色背景搭配淡蓝色装饰。
- **Purpose**: 为VEX选手提供一个简单、专注的工具来追踪备赛进度，记录每天的工作内容，方便回顾和规划。
- **Target Users**: VEX机器人竞赛选手、备赛团队成员。

## Goals
- 提供简洁直观的时间轴界面展示每日记录
- 支持快速添加、编辑、删除每日记录
- 提供按天线性导航和按月查看两种视图
- 数据本地存储，无需后端服务
- 作为PWA支持离线使用和添加到主屏幕

## Non-Goals (Out of Scope)
- 云端数据同步和用户账户系统
- 团队协作和多人编辑功能
- 复杂的任务管理（如任务分配、截止日期提醒等）
- 社交媒体分享功能

## Background & Context
- 设计风格：Nothing风格，简洁科技风，白色背景、淡蓝色为装饰色
- 技术栈：纯前端PWA应用，使用IndexedDB进行本地数据存储
- 设计规范：严格遵循nothing-design系统的设计原则和组件规范

## Functional Requirements
- **FR-1**: 用户可以按天查看时间轴，左右切换日期
- **FR-2**: 用户可以按月查看，选择月份后查看该月的记录概览
- **FR-3**: 用户可以添加每日记录（标题、日期、内容）
- **FR-4**: 用户可以编辑和删除已有的记录
- **FR-5**: 时间轴视图以垂直时间线形式展示每日记录
- **FR-6**: 应用支持PWA功能（离线可用、添加到主屏幕）

## Non-Functional Requirements
- **NFR-1**: 界面完全遵循nothing-design设计规范
- **NFR-2**: 响应式设计，适配移动设备和桌面设备
- **NFR-3**: 快速的页面加载和响应时间（<100ms交互延迟）
- **NFR-4**: 数据持久化，刷新页面不丢失记录
- **NFR-5**: 无网络时仍可正常使用所有功能

## Constraints
- **Technical**: 纯前端实现，使用HTML/CSS/JavaScript或现代前端框架，IndexedDB本地存储
- **Business**: 无需后端服务，完全本地运行
- **Dependencies**: nothing-design系统的设计规范和组件

## Assumptions
- 用户设备支持IndexedDB和PWA功能
- 淡蓝色作为装饰色，用于交互元素（链接、按钮激活状态等）
- 初始默认使用浅色模式（白色背景）

## Acceptance Criteria

### AC-1: 时间轴按天查看功能
- **Given**: 用户打开应用
- **When**: 用户查看默认视图
- **Then**: 显示当天日期的时间轴，支持左右滑动或点击箭头切换前后天
- **Verification**: `programmatic`
- **Notes**: 日期显示使用Space Mono字体，ALL CAPS标签样式

### AC-2: 按月查看功能
- **Given**: 用户在时间轴视图
- **When**: 用户切换到月视图
- **Then**: 显示当前月份的日历网格，标注有记录的日期
- **Verification**: `programmatic`

### AC-3: 添加记录功能
- **Given**: 用户在某个日期的视图
- **When**: 用户点击添加记录按钮，填写标题和内容并保存
- **Then**: 新记录出现在该日期的时间轴上，数据保存到本地存储
- **Verification**: `programmatic`

### AC-4: 编辑和删除记录功能
- **Given**: 用户查看已有记录
- **When**: 用户点击编辑或删除记录
- **Then**: 记录被更新或移除，本地存储同步更新
- **Verification**: `programmatic`

### AC-5: Nothing设计风格合规
- **Given**: 应用的所有界面
- **When**: 用户浏览和交互
- **Then**: 界面符合nothing-design规范（字体、颜色、间距、组件样式）
- **Verification**: `human-judgment`
- **Notes**: 使用Space Grotesk作为主要字体，Space Mono用于标签和数据，淡蓝色用于交互元素

### AC-6: PWA功能
- **Given**: 用户访问应用
- **When**: 用户在支持PWA的浏览器中
- **Then**: 可以添加到主屏幕，离线时仍可使用
- **Verification**: `programmatic`

## Open Questions
- [ ] 淡蓝色的具体色值需要确认（建议使用 #5B9BF6 或 #007AFF）
- [ ] 是否需要支持深色模式？
