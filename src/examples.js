// 每种常见图各一个示例（中文标签）
export const EXAMPLES = [
  {
    id: 'flowchart', name: '流程图 flowchart',
    code: `flowchart TD
    A[用户提交 Markdown] --> B{包含 Mermaid 吗？}
    B -->|是| C[逐个渲染成 SVG]
    B -->|否| G[直接转存飞书]
    C --> D[栅格化为 2x PNG]
    D --> E[写入剪贴板]
    E --> F([粘贴进飞书文档])
    G --> F`,
  },
  {
    id: 'sequence', name: '时序图 sequence',
    code: `sequenceDiagram
    participant U as 用户
    participant W as 网页
    participant F as 飞书
    U->>W: 粘贴 Mermaid 源码
    W->>W: 浏览器内渲染预览
    U->>W: 点击「复制 PNG」
    W-->>U: 图片已写入剪贴板
    U->>F: Ctrl/⌘ + V 粘贴
    F-->>U: 文档里出现高清图片`,
  },
  {
    id: 'state', name: '状态图 state',
    code: `stateDiagram-v2
    [*] --> 草稿
    草稿 --> 审核中: 提交
    审核中 --> 已发布: 通过
    审核中 --> 草稿: 驳回
    已发布 --> 已归档: 下线
    已归档 --> [*]`,
  },
  {
    id: 'class', name: '类图 class',
    code: `classDiagram
    class Diagram {
      +String 源码
      +String 主题
      +render() SVG
    }
    class Exporter {
      +int 倍率
      +toPNG() Blob
      +toClipboard() void
    }
    class FeishuDoc {
      +String 文档ID
      +insertImage() void
    }
    Diagram --> Exporter : 导出
    Exporter --> FeishuDoc : 写入`,
  },
  {
    id: 'er', name: 'ER 图 erDiagram',
    code: `erDiagram
    用户 ||--o{ 文档 : 创建
    文档 ||--|{ 图片 : 包含
    用户 {
      string id PK
      string 昵称
    }
    文档 {
      string id PK
      string 标题
    }
    图片 {
      string token PK
      int 宽度
    }`,
  },
  {
    id: 'xychart', name: 'XY 图 xychart',
    code: `xychart-beta
    title "每月转存到飞书的图数量"
    x-axis ["一月", "二月", "三月", "四月", "五月", "六月"]
    y-axis "张数" 0 --> 120
    bar [32, 45, 58, 71, 88, 104]
    line [32, 45, 58, 71, 88, 104]`,
  },
  {
    id: 'gantt', name: '甘特图 gantt（回退 mermaid.js）',
    code: `gantt
    title Mermaid 转飞书 排期
    dateFormat YYYY-MM-DD
    axisFormat %m-%d
    todayMarker off
    section 第一版
    网站与预览     :done,   a1, 2026-10-22, 2d
    复制 PNG       :active, a2, after a1, 2d
    section 第二版
    渲染接口       :        b1, after a2, 3d
    写入飞书文档   :        b2, after b1, 4d`,
  },
  {
    id: 'pie', name: '饼图 pie（回退 mermaid.js）',
    code: `pie title 文档里的图类型占比
    "流程图" : 45
    "时序图" : 25
    "状态图" : 12
    "其他" : 18`,
  },
  {
    id: 'board', name: '画板风流程 flowchart LR（配「飞书画板蓝」）',
    code: `flowchart LR
    L[线上日志 / 实验表现] --> R[定期查看日志和实验数据]
    R --> S[按业务场景分别检查并汇总多天变化]
    S --> Q{发现问题或指标异常?}
    Q -->|是| P[PMO Agent 派发给相关领域 Agent]
    Q -->|否| R
    P --> X[结合日志和实验数据排查]
    X --> H{需要业务判断或人工帮助?}
    H -->|是| B[相关业务 / 产品人员参与确认]
    H -->|否| C[确认问题与处理方案]
    B --> C
    C --> F[修复、回归验证并记录结果]
    F --> R`,
  },
]
