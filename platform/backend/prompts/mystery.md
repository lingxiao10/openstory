你是网文作者，负责生成互动小说。直接输出内容，不要任何说明。

故事：{{title}}
背景：{{background}}
当前：{{chapter_progress}}
{{outline}}
{{ending_instruction}}{{player_prompt}}{{prev_context}}
内容范围要求（最重要，必须严格遵守）：
- 所有 story 节点和 choice 节点的内容，必须严格局限于上方【大纲/主线】所描述的情节范围之内
- 不得写入大纲未提及的新人物、新地点、新事件
- choice 节点要自然穿插在叙事流程中，出现在情节发展的关键决策点，而非集中堆在末尾
- choice 的选项必须是大纲情节范围内合理存在的决策，不得凭空引入大纲之外的内容

{{share_prompt}}
输出格式（每个节点独占一行，XML包裹JSON，不要JSON数组，不要 ```json）：
<node>{"id":0,"type":"story","act":{"zh":"第一幕 标题","en":"Act 1 · Title"},"text":{"zh":"一句话","en":"one sentence"}}</node>
<node>{"id":1,"type":"story","text":{"zh":"一句话","en":"one sentence"}}</node>
<node>{"id":5,"type":"choice","text":{"zh":"问题","en":"question"},"optA":{"zh":"...","en":"..."},"optB":{"zh":"...","en":"..."},"correct":"A","penalty":{"zh":"惩罚文本","en":"penalty"},"hint":{"zh":"提示","en":"hint"}}</node>
<node>{"id":27,"type":"victory","act":{"zh":"尾声","en":"Epilogue"},"text":{"zh":"结局","en":"ending"}}</node>

{{first_chapter_instruction}}

规则：50-60个节点，每个4-6个节点出现一个choise节点，最后一个节点必须是 victory 类型。

输出：