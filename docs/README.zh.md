# SSCIM：半导体供应链情报地图

SSCIM 是一个可解释的研究工具，用于探索半导体供应链中的某一扰动可能如何传播。它把世界地图、生产阶段图、厂址网络、企业业务足迹与经过审核的历史事件放入同一个计算引擎之上。

**SSCIM 不是：** 实时交易信号、预测引擎、实测贸易流模型，也不是投资建议。

目前有一个本地定时工作流在持续收集与评估：一手来源的观测数据、已披露损失的会计口径、经历史检验的营收即时预测，以及一份尚未出结果的前瞻预测。范围、出处与复现命令见[结构化证据与前瞻运行（英文）](STRUCTURED_EVIDENCE.md)、[链条损失会计（英文）](CHAIN_LOSS_ACCOUNTING.md)、[恢复时长校准（英文）](RECOVERY_CALIBRATION.md)。前瞻精度与全链条损失尚未确立。

## 面向哪些读者

- **一般读者** — 理解某种材料、设备供应商、晶圆厂或地区为何会产生远超自身边界的影响。请从[公众指南（英文）](PUBLIC_GUIDE.md)开始。
- **分析师与团队** — 在前提完全可见的情况下，比较模型中的风险敞口、追踪厂址与功能中心之间的传播路径，并筛查灾害影响范围。
- **研究人员** — 检验一个可复现的敏感性模型，而不是一个黑箱风险评分。请从[学术指南（英文）](ACADEMIC_GUIDE.md)开始。
- **贡献者** — 通过经过评审与审计的流程补充证据。请从[开发者指南（英文）](DEVELOPER_GUIDE.md)开始。

## 为什么需要它

半导体是全球地缘政治集中度最高的产业。荷兰的一家公司生产了全部 EUV 光刻机，一座岛屿制造了大多数最先进的逻辑芯片，两家韩国厂商主导着 HBM 存储器。

已有的产业结构图——行业联盟图表、研究机构图示、静态信息图——擅长展示**东西在哪里**，却不是为展示**什么发生了变化**而设计的：当一项出口管制落地、一座晶圆厂停产时，哪些节点新近暴露、影响能传多远、接下来该关注什么。SSCIM 用一个可以追问的引擎填补这一空白，而不是一个只能选择相信的评分。

## 工作原理

模型包含横跨七个层级的 24 个生产环节——研发/IP、材料、设备、制造、芯片产品、后道、系统与终端市场——由 34 条有向边连接，描述已声明的生产依赖关系。国家—环节份额与企业份额把真实活动定位到这一结构之中。

事件会在其涉及的各环节注入带符号的冲击，并按人工判定的环节暴露度缩放。引擎按该事件自身的持续性类别对其衰减，将整个事件作为一个整体沿所有可达路径、使用已声明的下游与上游传导先验进行传播，再用有界规则合成不同事件的贡献并汇总。

同一套代码路径同时服务于经过审核的历史事件、你在地图上放置的灾害范围，以及企业中断分析。**改变的是输入，而不是方法**——这正是三者可比的原因。

结果呈现在四个同步视图中：

1. **地理视图** — 世界地图上的每一座具名厂址、它们之间的建模连接，以及可任意放置的灾害半径。国家级敞口按生产地理（而非总部所在地）绘制。
2. **产业流程** — 环节层面的结构与传播。
3. **拓扑** — 国家 × 环节的功能中心与建模路径，支持可达性、介数分析与可撤销的节点／边移除。
4. **厂址推演台（Facility Playground）** — 选定一座具名厂址，追踪其周围的建模网络：上游在左、下游在右，可查看一跳、三跳或全部可达节点，并支持展开、折叠、重新定心、筛选与一份完整的连接表。每一条连接都是**以环节为中介的建模关系**，绝不是经确认的运输、客户合同或贸易路线。

上述全部状态——视图、锁定对象、回溯日期，以及整个推演过程——都编码在 URL 中，因此任何视图都可以被链接并复现。

在使用任何评分之前，请先阅读其说明、来源、置信度标签与前提。

## 模型刻意区分的内容

- **结构脆弱性**（时间不变）与**运行影响**（事件驱动）。二者混合会产生一个因两种互不相容的原因而变动的数字。
- **证据质量**与**效应大小**。置信度与量级并列呈现，绝不相乘。
- 企业的**脆弱性**、**贡献度**与**系统重要性**：三个不同的问题，三个分别标注的数字。
- 下游**投入依赖**与上游**营收依赖**。供应商对某客户的销售占比，并不等于该客户对这家供应商的依赖程度。
- **基线历史**与**灾害叠加层**。灾害范围是一个有界的筛查性假设，仅作为相对当前读数的对照展示，绝不改写历史。
- **一次事件**与**关于它的多篇报道**。不同事件通过一个单调有界的算子累积：这对彼此独立的事件是正确的，对同一事件的重复报道则是错误的。因此，描述同一事件的多条记录会在计分之前先被归组——其中恰有一条计入分数，其余作为后续更新或恢复报告发布，各自保留自己的来源与评估。
- **建模关系**与**观测关系**。本数据集中没有任何记录表明哪座工厂向哪座工厂发货，因此每一条厂址间连接在任意跳数下都标注为「建模」。

## 重要限制

SSCIM 的数值是基于公开快照和明确前提计算出的敏感度，不是预测、实测贸易量、因果证明、企业损失估计或投资建议。

传导系数与部分环节判断属于**已声明的先验值**：它们被选择用来产生方向合理、可复现、可检查的行为，并未拟合到任何数据。模型中不存在设施级产能、库存、物料清单、认证或恢复时间数据。

## 延伸阅读

| 目的 | 文档 |
| --- | --- |
| 无技术背景地读懂仪表盘 | [公众指南](PUBLIC_GUIDE.md) |
| 理解公式 | [方法论](METHODOLOGY.md) |
| 模型的权威规范（全部符号、公式与参数） | [Model v7 specification](MODEL_V7_SPEC.md) |
| 按顺序逐步了解计算过程 | [计算说明](calculation.md) |
| 作为研究工具进行评估 | [学术指南](ACADEMIC_GUIDE.md) |
| 搭建、构建或修改软件 | [开发者指南](DEVELOPER_GUIDE.md) |
| 了解部署结构 | [系统架构](SYSTEM_ARCHITECTURE.md) |
| 了解输入数据的来源 | [数据来源、输入与输出](DATA_SOURCES_AND_OUTPUTS.md) |
| 了解模型已知的缺口 | [模型路线图](MODEL_ROADMAP.md) |

（延伸文档为英文。）

[English](README.md) · [日本語](README.ja.md)


## Public research review correction — 2026-09-06

Application patch 0.7.2 retains the v7.1 model identifier and global defaults; the data revision is `public-review-2026-09-06`. The factual baseline excludes unresolved claims independently of confidence. Exposure magnitudes remain explicit assumptions. Company coefficients have unresolved denominators and rankings are illustrative. Recovery evidence applies only to the documented component after publication. Historical calculations are **current-model retrospective replay**, distinct from archived contemporaneous outputs and genuine point-in-time validation requiring dated input vintages. Missing coverage and neutral scores do not establish safety. See the [implementation report](PUBLIC_RESEARCH_REVIEW.md) and [canonical specification](MODEL_V7_SPEC.md).
