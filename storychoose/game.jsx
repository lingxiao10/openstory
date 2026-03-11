// import { useState, useEffect, useCallback, useRef } from "react";
const { useState, useEffect, useCallback, useRef } = React;

// ============================================================
// 【故事数据层】- 所有故事内容、选项、数值效果都在这里
// 修改故事只需修改这个数组，不需要动游戏引擎代码
// ============================================================

// 道具定义
const ITEM_DEFS = {
  iron_pipe: { name: "铁管", icon: "🔧", desc: "沉重但打起来很疼" },
  dagger: { name: "匕首", icon: "🗡️", desc: "轻便锋利，适合偷袭" },
  medkit: { name: "急救包", icon: "💊", desc: "关键时刻能救命" },
  food_pack: { name: "高能口粮", icon: "🥫", desc: "补充体力的好东西" },
  hammer: { name: "铁锤", icon: "🔨", desc: "一锤子下去非死即伤" },
  bow: { name: "自制弓", icon: "🏹", desc: "远程攻击，安全可靠" },
  lighter: { name: "打火机", icon: "🔥", desc: "黑暗中的希望之光" },
  rope: { name: "绳索", icon: "🪢", desc: "攀爬捆绑都好用" },
};

// 四维属性定义
const STAT_DEFS = {
  life: { name: "生命", icon: "❤️", color: "#ef4444", bg: "#7f1d1d" },
  stamina: { name: "体力", icon: "⚡", color: "#f59e0b", bg: "#78350f" },
  mood: { name: "心情", icon: "😊", color: "#3b82f6", bg: "#1e3a5f" },
  supplies: { name: "物资", icon: "🎒", color: "#22c55e", bg: "#14532d" },
};

// 70张卡片的完整故事数据
// 规则：拿道具不改数值，每个选择只影响1-2个属性，四种属性均匀分布
const STORY_DATA = [
  // === 废墟觉醒 (0-3) ===
  { id: 0, type: "story", text: "我从碎石堆里醒过来，全身疼得要死，天是灰红色的，远处有不像人的叫声。" },
  { id: 1, type: "story", text: "口袋里有张皱巴巴的纸条——「往北走，曙光营地，最后的安全区」。" },
  { id: 2, type: "story", text: "我在废墟里翻了一阵，找到两样东西。" },
  {
    id: 3, type: "choice",
    text: "一根铁管和一把匕首，只能带一样，多了跑不动。",
    choices: [
      { label: "拿铁管", text: "铁管挺沉，但抡起来什么脑袋都得开瓢。", effects: { life: 0, stamina: 0, mood: 0, supplies: 0 }, giveItem: "iron_pipe" },
      { label: "拿匕首", text: "匕首插腰上几乎没重量，灵活才是活下去的关键。", effects: { life: 0, stamina: 0, mood: 0, supplies: 0 }, giveItem: "dagger" },
    ],
  },
  // === 上路 (4-6) 心情↔物资 ===
  { id: 4, type: "story", text: "路两边的楼全塌了一半，到处是干掉的血迹，但没尸体——那些东西什么都吃。" },
  { id: 5, type: "story", text: "走了俩小时，药店废墟里传出声音：「救命……有人吗……」" },
  {
    id: 6, type: "choice",
    text: "有人在求救，但末日之后什么陷阱都有。",
    choices: [
      // 救了人心里踏实→心情+2，大叔给了打火机但搬碎石耗了水→物资-1
      { label: "过去救人", text: "救出个大叔他给了个打火机，心里挺踏实的，就是搬碎石出了一身汗水壶快见底了。", effects: { life: 0, stamina: 0, mood: 2, supplies: -1 }, giveItem: "lighter" },
      // 省了物资→物资+1，但良心不安→心情-2
      { label: "装没听见", text: "我加快脚步走了没浪费一滴水，但那声音越来越弱，心里堵得慌。", effects: { life: 0, stamina: 0, mood: -2, supplies: 1 } },
    ],
  },
  // === 第一次遇怪 (7-9) 生命↔心情 ===
  { id: 7, type: "story", text: "拐进巷子，我第一次近距离看到那种东西——一个灰白色的人形怪物蹲在车上啃死猫。" },
  { id: 8, type: "story", text: "它闻到我了，猛转过头，比正常人高一头，指甲跟刀片似的。" },
  {
    id: 9, type: "choice",
    text: "它朝我扑过来了。",
    choices: [
      // 胳膊被抓→生命-2，但杀了它信心大增→心情+2
      { label: "正面干", text: "干掉了它但胳膊被抓了道口子，不过第一次杀怪信心爆棚。", effects: { life: -2, stamina: 0, mood: 2, supplies: 0 }, bonusIf: { item: "iron_pipe", bonus: { life: 2, stamina: 0, mood: 0, supplies: 0 } } },
      // 没受伤→生命+1，但逃跑太窝囊→心情-2
      { label: "撒腿就跑", text: "跑了三条街甩掉了人倒是没事，但跑得跟狗一样太窝囊了。", effects: { life: 1, stamina: 0, mood: -2, supplies: 0 }, bonusIf: { item: "dagger", bonus: { life: 0, stamina: 0, mood: 2, supplies: 0 } } },
    ],
  },
  // === 遇到苏晴 (10-13) 生命↔物资 ===
  { id: 10, type: "story", text: "我靠在一个门面房里歇气，手还在抖，这世界真他妈的疯了。" },
  { id: 11, type: "story", text: "门口突然进来个穿脏白大褂的女孩——「别紧张！我叫苏晴，是护士。」" },
  { id: 12, type: "story", text: "她也要去曙光营地，说有个伴比单打独斗好，我没理由拒绝，就一起走了。" },
  {
    id: 13, type: "choice",
    text: "苏晴说她会包扎，让我把伤口给她看看，不过得用掉一些绷带。",
    choices: [
      // 伤口处理好了→生命+2，但用掉了药品→物资-1
      { label: "让她处理伤口", text: "她手法很利索帮我包扎好了伤口不疼了，就是消毒水和绷带用掉不少。", effects: { life: 2, stamina: 0, mood: 0, supplies: -1 } },
      // 省物资→物资+1，但伤口发炎了→生命-2
      { label: "先留着药品赶路", text: "我说不急留着以后用，结果伤口越来越疼到晚上开始发炎了。", effects: { life: -2, stamina: 0, mood: 0, supplies: 1 } },
    ],
  },
  // === 超市 (14-16) 体力↔物资 ===
  { id: 14, type: "story", text: "有个伴果然不一样，路上有人说话不那么闷了，苏晴笑起来有个小酒窝。" },
  { id: 15, type: "story", text: "路边有个被砸烂大门的超市，里面黑漆漆的，不知道有没有东西，也不知道有没有危险。" },
  {
    id: 16, type: "choice",
    text: "进去搜还是算了？",
    choices: [
      // 找到不少东西→物资+3，但搜了太久累坏→体力-2
      { label: "仔细搜", text: "翻了一遍找到不少吃的和绷带收获很大，但搜了太久累得腿都不是自己的了。", effects: { life: 0, stamina: -2, mood: 0, supplies: 3 } },
      // 省力气→体力+1，就拿了一点→物资-1（相对来说少拿了等于亏）
      { label: "门口抓几样就撤", text: "在门口顺了几样就走了，没怎么费劲但也没搜到多少好东西。", effects: { life: 0, stamina: 1, mood: 0, supplies: -1 } },
    ],
  },
  // === 路上 (17-20) 生命↔心情 ===
  { id: 17, type: "story", text: "穿过居民区，到处是空窗户，苏晴说：「这地方拍恐怖片都不用布景。」" },
  { id: 18, type: "story", text: "她说毕业才一年就末日了，「第一个月房租都没交呢世界就完了。」" },
  { id: 19, type: "story", text: "前面传来连续枪声，不是单发是连射，有人在打仗而且装备很好。" },
  {
    id: 20, type: "choice",
    text: "枪声从东边传来，越来越近了，得赶紧决定怎么办。",
    choices: [
      // 帮忙打架受了点伤→生命-1，但帮了人心里痛快→心情+2
      { label: "冲过去帮忙", text: "一个短发女人单挑三只变异犬，我冲上去帮忙被刮了一下，不过打赢了心里痛快。", effects: { life: -1, stamina: 0, mood: 2, supplies: 0 } },
      // 没受伤→生命+1，但眼看着别人拼命自己躲着心里过不去→心情-2
      { label: "找掩体观察", text: "躲在车后面看那女人浴血奋战自己缩着不动，人没事但心里特别不是滋味。", effects: { life: 1, stamina: 0, mood: -2, supplies: 0 } },
    ],
  },
  // === 林夕 (21-23) 物资↔心情 ===
  { id: 21, type: "story", text: "那个女人叫林夕，前特警，短发，左脸有道疤，眼神冷得像刀子，手里拿着十字弩。" },
  { id: 22, type: "story", text: "她也要去曙光营地，一个人走了三天弹药快没了，自然而然就一起走了。" },
  {
    id: 23, type: "choice",
    text: "林夕三天没怎么吃东西了，脸色很差，但她不好意思开口。",
    choices: [
      // 分了食物→物资-2，但大家关系好了→心情+2
      { label: "主动分她食物", text: "我把吃的分了一份给她，她接过去的时候手在抖，吃完脸色好多了大家都轻松不少。", effects: { life: 0, stamina: 0, mood: 2, supplies: -2 } },
      // 省物资→物资+1，但气氛尴尬→心情-2
      { label: "假装没注意到", text: "我没说什么继续赶路，林夕硬撑着走但眼神更冷了，气氛尴尬得要命。", effects: { life: 0, stamina: 0, mood: -2, supplies: 1 } },
    ],
  },
  // === 补给 (24-26) ===
  { id: 24, type: "story", text: "三个人走快多了，林夕在前面探路，偶尔回头看看苏晴，眼神没那么冷了。" },
  { id: 25, type: "story", text: "傍晚到了个加油站，便利店货架上还剩点东西，但背包只装得下一类。" },
  {
    id: 26, type: "choice",
    text: "药品还是食物，只能选一样。",
    choices: [
      { label: "急救药品", text: "消毒水绷带止痛药，苏晴说有这些她就能处理大部分伤口。", effects: { life: 0, stamina: 0, mood: 0, supplies: 0 }, giveItem: "medkit" },
      { label: "高能口粮", text: "压缩饼干和能量棒，味道一言难尽但至少有得吃了。", effects: { life: 0, stamina: 0, mood: 0, supplies: 0 }, giveItem: "food_pack" },
    ],
  },
  // === 赵铁登场 (27-31) 心情↔生命 ===
  { id: 27, type: "story", text: "第二天走了没俩小时，前后路口突然全被车堵死了，林夕瞬间拉起弩。" },
  { id: 28, type: "story", text: "冒出七八个拿棍棒砍刀的，领头的独眼满脸横肉，叼着烟——他们叫他蝎子。" },
  { id: 29, type: "story", text: "蝎子后面走出个光头纹蜈蚣的，转着刀慢悠悠的：「我叫赵铁，过路费——交出所有东西。」" },
  { id: 30, type: "story", text: "赵铁看着苏晴和林夕：「两个漂亮姑娘，要不留下来？」蝎子在旁边猥琐地笑。" },
  {
    id: 31, type: "choice",
    text: "他们七八个人，我们三个，硬拼吃亏但就这么认怂也咽不下去。",
    choices: [
      // 被揍了→生命-3，但出了口气→心情+2
      { label: "反抗", text: "我一拳打蝎子脸上，但人太多被按地上揍了一顿，不过这口气出了值。", effects: { life: -3, stamina: 0, mood: 2, supplies: 0 } },
      // 没受伤但被羞辱到极点→心情-3，物资被抢→物资-2
      { label: "先忍了", text: "我把东西倒地上，蝎子当面嚼我的吃的还撞了苏晴一下，窝囊到想死。", effects: { life: 0, stamina: 0, mood: -3, supplies: -2 } },
    ],
  },
  // === 遇见小萌 (32-36) 心情↔物资 ===
  { id: 32, type: "story", text: "赵铁走了，苏晴蹲在我旁边擦伤口，嘴唇抿得紧紧的，林夕盯着他们离开的方向。" },
  { id: 33, type: "story", text: "总有一天我会让那个秃头好看。苏晴按了按我肩膀：「先活着，有命在什么都有机会。」" },
  { id: 34, type: "story", text: "经过一个便利店，收银台后面突然弹出个脑袋：「啊！」一个扎俩揪揪的女孩抱着一袋薯片。" },
  { id: 35, type: "story", text: "她叫小萌，高三生，在这躲了好几天了，居然还在笑：「太好了有活人！我快闷死了！」" },
  {
    id: 36, type: "choice",
    text: "小萌跟着我们走了，她手里那袋薯片哗哗响，大家都饿得不行。",
    choices: [
      // 分吃薯片大家开心→心情+2，但吃完没存货了→物资-2
      { label: "一起分着吃薯片", text: "薯片分了每人一把，久违的零食味让大家都笑了，就是吃完啥也不剩了。", effects: { life: 0, stamina: 0, mood: 2, supplies: -2 } },
      // 有存粮→物资+1，但气氛沉闷→心情-2
      { label: "让她把薯片收好省着吃", text: "我说留着路上慢慢吃，小萌乖乖收起来不吱声了，气氛沉闷了不少。", effects: { life: 0, stamina: 0, mood: -2, supplies: 1 } },
    ],
  },
  // === 变异犬 (37-39) 生命↔物资 ===
  { id: 37, type: "story", text: "远处天际线有几道黑烟，小萌说那方向以前是她学校，然后她安静了好一会儿。" },
  { id: 38, type: "story", text: "穿过公园的时候草丛里窜出六七只变异犬，没毛，灰色皮，牙齿跟刀子一样，把我们围了。" },
  {
    id: 39, type: "choice",
    text: "变异犬堵路了，太多了不好打，但我包里还有食物。",
    choices: [
      // 被咬了小腿→生命-2，但没损失物资
      { label: "打穿过去", text: "林夕弩射倒两只，我被一只咬了小腿，苏晴砸石头才救下我，打完赢了但腿在流血。", effects: { life: -2, stamina: 0, mood: 0, supplies: 0 }, bonusIf: { item: "iron_pipe", bonus: { life: 2, stamina: 0, mood: 0, supplies: 0 } } },
      // 扔了大量食物→物资-3，人没事
      { label: "扔食物引开", text: "把吃的全扔出去它们一窝蜂扑过去，趁机跑了人倒是没事但物资全没了。", effects: { life: 0, stamina: 0, mood: 0, supplies: -3 } },
    ],
  },
  // === 过夜 (40-44) 体力↔心情 ===
  { id: 40, type: "story", text: "天快黑了，那些东西晚上更活跃，必须找地方躲。" },
  { id: 41, type: "story", text: "前面一个地下车库又黑又闷但隐蔽，旁边居民楼天台开阔但暴露。" },
  {
    id: 42, type: "choice",
    text: "在哪过夜？",
    choices: [
      // 安全休息→体力+2，但又黑又闷→心情-2
      { label: "地下车库", text: "用车堵了入口睡了个安稳觉体力恢复不少，但黑得跟棺材似的发霉味太上头了。", effects: { life: 0, stamina: 2, mood: -2, supplies: 0 } },
      // 看星星心情好→心情+2，但冻了一夜没怎么睡→体力-2
      { label: "楼顶天台", text: "满天星星苏晴靠在我旁边聊天心情特别好，但风太大冻得一夜没怎么合眼。", effects: { life: 0, stamina: -2, mood: 2, supplies: 0 } },
    ],
  },
  { id: 43, type: "story", text: "半夜苏晴来换班，突然说：「末日之前我连跟喜欢的人表白都不敢，现在想想真傻。」" },
  { id: 44, type: "story", text: "她转头看我：「到了营地我请你吃罐头吧，现在只有这个了。」月光下她笑了。" },
  // === 赵铁再来 (45-47) 体力↔生命 ===
  { id: 45, type: "story", text: "第二天上路没多远，林夕突然抬手——她听到引擎声了。" },
  { id: 46, type: "story", text: "一辆改装皮卡冲出来，蝎子站在车上端着霰弹枪：「赵哥说了，上次的账没算完。」" },
  {
    id: 47, type: "choice",
    text: "这次蝎子有枪了，身后是死路，退无可退。",
    choices: [
      // 拼命→体力-3，但没受什么重伤→生命+1（肾上腺素）
      { label: "拼了", text: "林夕射中蝎子手臂枪脱手，我拼命放倒两个累到脱力，但靠着一股狠劲没让自己倒下。", effects: { life: 1, stamina: -3, mood: 0, supplies: 0 }, bonusIf: { item: "dagger", bonus: { life: 0, stamina: 2, mood: 0, supplies: 0 } } },
      // 保存了体力→体力+1，但跑的时候被刮伤→生命-2
      { label: "散开跑", text: "「分头跑！」没怎么费力气但跑的时候被铁丝网刮了一道大口子，血流了一路。", effects: { life: -2, stamina: 1, mood: 0, supplies: 0 } },
    ],
  },
  // === 苏晴被抓 (48-52) 心情↔物资 ===
  { id: 48, type: "story", text: "我跟林夕小萌汇合了，但苏晴不在，我喊她名字没人应。" },
  { id: 49, type: "story", text: "远处传来她的尖叫，蝎子把她按在皮卡车斗里一脚踩着她的背。" },
  { id: 50, type: "story", text: "赵铁摇下车窗竖了个中指：「小护士我先借走了，想要的话来东边钢铁厂找我。」车开走了。" },
  { id: 51, type: "story", text: "林夕射了一箭扎进轮胎但车没停，我跪在地上拳头砸柏油路面，小萌哭了。" },
  {
    id: 52, type: "choice",
    text: "林夕说：「我知道那个厂在哪，但我们现在去等于送死。」",
    choices: [
      // 愤怒化为动力→心情+3，但来不及搜物资→物资-2
      { label: "我不管立刻去", text: "我满脑子都是苏晴的脸顾不上别的了，什么都没带就往东跑。", effects: { life: 0, stamina: 0, mood: 3, supplies: -2 } },
      // 理性搜刮→物资+2，但苏晴在受苦我在这歇着→心情-3
      { label: "先找装备", text: "忍住冲动先搜了一圈找到些东西，但想到苏晴还在那受苦我心如刀绞。", effects: { life: 0, stamina: 0, mood: -3, supplies: 2 } },
    ],
  },
  // === 前往钢铁厂 (53-56) ===
  { id: 53, type: "story", text: "钢铁厂在东边五公里，以前是冶炼厂，赵铁改成了老巢，守卫都有武器。" },
  { id: 54, type: "story", text: "路上林夕在翻倒的工程车里找到两样东西摆在我面前。" },
  { id: 55, type: "story", text: "一把钢管焊的铁锤，和一张用弹簧钢丝做的弓配五支铁箭。" },
  {
    id: 56, type: "choice",
    text: "要去打架了，选个靠得住的家伙。",
    choices: [
      { label: "铁锤", text: "死沉，但一下能砸碎脑袋，正面突破就靠它了。", effects: { life: 0, stamina: 0, mood: 0, supplies: 0 }, giveItem: "hammer" },
      { label: "自制弓", text: "拉了拉弹性不错，五支箭不多但能远程解决问题。", effects: { life: 0, stamina: 0, mood: 0, supplies: 0 }, giveItem: "bow" },
    ],
  },
  // === 巨型变异体 (57-59) 生命↔体力 ===
  { id: 57, type: "story", text: "钢铁厂到了，但大门前蹲着一只我没见过的东西——两米多高四条腿，身上长着甲壳。" },
  { id: 58, type: "story", text: "它喘着粗气带着腐烂恶臭，要进厂必须过它这关，不过它好像视力不太好靠闻的。" },
  {
    id: 59, type: "choice",
    text: "甲壳很硬正面不一定打得穿，但它转身慢。",
    choices: [
      // 被甩了一下→生命-3，但没怎么跑省体力→体力+1
      { label: "正面打", text: "被它甩了一下差点断骨头，但找到缝隙捅进去了，好在没怎么跑没费多少力气。", effects: { life: -3, stamina: 1, mood: 0, supplies: 0 }, bonusIf: { item: "hammer", bonus: { life: 2, stamina: 0, mood: 0, supplies: 0 } } },
      // 疯跑→体力-3，但人没受伤→生命+1
      { label: "引开它溜过去", text: "小萌扔石头我们从侧面疯跑绕过去了人没事，就是跑得上气不接下气快虚脱了。", effects: { life: 1, stamina: -3, mood: 0, supplies: 0 }, bonusIf: { item: "bow", bonus: { life: 0, stamina: 2, mood: 0, supplies: 0 } } },
    ],
  },
  // === 潜入 (60-62) 物资↔体力 ===
  { id: 60, type: "story", text: "绕到侧面围墙有几个洞，里面传来笑声——赵铁的人在喝酒，大概五六个。" },
  { id: 61, type: "story", text: "小萌指着一个生锈侧门：「那好像没人。」正门倒是只有两个哨兵看着不太精神。" },
  {
    id: 62, type: "choice",
    text: "正门人少但会被看见，侧门隐蔽但不知里面啥情况。",
    choices: [
      // 干掉门卫搜了身→物资+1，但打了一架很费劲→体力-2
      { label: "正门强攻", text: "林夕放倒门卫我顺手搜了他们身上翻到点东西，但打进去费了不少劲。", effects: { life: 0, stamina: -2, mood: 0, supplies: 1 }, bonusIf: { item: "dagger", bonus: { life: 0, stamina: 0, mood: 2, supplies: 0 } } },
      // 没费力→体力+1，但什么也没捡到→物资-1（绕远路消耗）
      { label: "侧门偷偷进", text: "从侧门悄悄溜进去没怎么费劲，但绕了一大圈路上喝完了最后的水。", effects: { life: 0, stamina: 1, mood: 0, supplies: -1 } },
    ],
  },
  // === 救苏晴 (63-66) 生命↔心情 ===
  { id: 63, type: "story", text: "在工厂深处的铁皮房里找到苏晴了，绑在椅子上贴着胶带，脸上有被打的痕迹。" },
  { id: 64, type: "story", text: "我解开绳子撕掉胶带，苏晴扑过来哭着说：「你真的来了……」" },
  { id: 65, type: "story", text: "门口传来鼓掌声，蝎子靠在门框上笑：「好感人啊，可惜故事到这该结束了。」" },
  {
    id: 66, type: "choice",
    text: "蝎子堵住出口举起刀：「让我看看你有多想带走这小妞。」",
    choices: [
      // 被砍了→生命-2，但把蝎子打爆了→心情+3
      { label: "单挑", text: "身上多了几道口子，但想到苏晴的伤我爆发了一下把蝎子打飞吐血倒地。", effects: { life: -2, stamina: 0, mood: 3, supplies: 0 }, bonusIf: { item: "medkit", bonus: { life: 2, stamina: 0, mood: 0, supplies: 0 } } },
      // 配合好没怎么受伤→生命+1，但便宜蝎子了没打死→心情-1
      { label: "和林夕夹攻", text: "林夕射箭扎他大腿我踹翻他没怎么受伤，但这狗东西没打死我心里不痛快。", effects: { life: 1, stamina: 0, mood: -1, supplies: 0 } },
    ],
  },
  // === 逃出 & 结尾 (67-69) ===
  { id: 67, type: "story", text: "跑出铁皮房，喇叭里传来赵铁的声音：「今天算你们走运，我迟早会找到你。」" },
  { id: 68, type: "story", text: "冲出工厂，苏晴虚弱但还在笑，小萌抱着她不撒手，林夕回头又朝工厂射了一箭。" },
  { id: 69, type: "story", text: "然后我看到了——北方地平线亮起一簇电灯光，不是火光，是文明的光。曙光营地，到了。\n\n—— 第一章 · 完 ——" },
];

// ============================================================
// 【游戏引擎层】- 纯逻辑与渲染，不含任何故事内容
// ============================================================

const MAX_STAT = 14;
const INIT_STAT = 7;
const TOTAL_CARDS = STORY_DATA.length;

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function applyEffects(stats, effects, inventory, choice) {
  const newStats = { ...stats };
  Object.keys(effects).forEach((k) => {
    newStats[k] = clamp((newStats[k] || 0) + effects[k], 0, MAX_STAT);
  });
  // Apply bonus if player has the required item
  if (choice?.bonusIf && inventory.includes(choice.bonusIf.item)) {
    Object.keys(choice.bonusIf.bonus).forEach((k) => {
      newStats[k] = clamp(
        (newStats[k] || 0) + choice.bonusIf.bonus[k],
        0,
        MAX_STAT
      );
    });
  }
  return newStats;
}

function isGameOver(stats) {
  return Object.values(stats).some((v) => v <= 0);
}

function getDeadStat(stats) {
  return Object.keys(stats).find((k) => stats[k] <= 0);
}

// Stat bar component
function StatBar({ statKey, value }) {
  const def = STAT_DEFS[statKey];
  const pct = (value / MAX_STAT) * 100;
  const isLow = value <= 3;
  const isCrit = value <= 1;
  
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (!isCrit) return;
    const interval = setInterval(() => {
      setPulse(p => !p);
    }, 1000);
    return () => clearInterval(interval);
  }, [isCrit]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
      <span style={{ fontSize: 14, flexShrink: 0 }}>{def.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
          <span
            style={{ 
              fontSize: 12, 
              fontWeight: "bold", 
              letterSpacing: 1,
              color: def.color, 
              opacity: 0.9 
            }}
          >
            {def.name}
          </span>
          <span
            style={{ 
              fontSize: 12, 
              fontFamily: "monospace", 
              fontWeight: "bold",
              color: isLow ? "#ef4444" : def.color,
              opacity: (isCrit && pulse) ? 0.5 : 1,
              transition: "opacity 0.5s ease-in-out"
            }}
          >
            {value}
          </span>
        </div>
        <div
          style={{ 
            height: 6, 
            borderRadius: 3, 
            overflow: "hidden",
            background: def.bg,
            border: "1px solid rgba(255,255,255,0.05)"
          }}
        >
          <div
            style={{
              height: "100%",
              borderRadius: 3,
              transition: "all 0.7s ease-out",
              width: `${pct}%`,
              background: isLow
                ? `linear-gradient(90deg, #ef4444, #f87171)`
                : `linear-gradient(90deg, ${def.color}99, ${def.color})`,
              boxShadow: isLow ? "0 0 8px #ef444488" : "none",
            }}
          />
        </div>
      </div>
    </div>
  );
}

// Effect preview tag
function EffectTag({ statKey, val }) {
  if (val === 0) return null;
  const def = STAT_DEFS[statKey];
  const positive = val > 0;
  return (
    <span
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-bold"
      style={{
        background: positive ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
        color: positive ? "#4ade80" : "#f87171",
        border: `1px solid ${positive ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
      }}
    >
      {def.icon}
      {positive ? "+" : ""}
      {val}
    </span>
  );
}

// Main game component
function ApocalypseGame() {
  const [screen, setScreen] = useState("title"); // title, game, gameover, complete
  const [cardIndex, setCardIndex] = useState(0);
  const [stats, setStats] = useState({
    life: INIT_STAT,
    stamina: INIT_STAT,
    mood: INIT_STAT,
    supplies: INIT_STAT,
  });
  const [inventory, setInventory] = useState([]);
  const [history, setHistory] = useState([]);
  const [showResult, setShowResult] = useState(null); // choice result text
  const [fadeIn, setFadeIn] = useState(true);
  const [statChanges, setStatChanges] = useState(null); // for flash effect
  const [showInventory, setShowInventory] = useState(false);
  const containerRef = useRef(null);

  const card = STORY_DATA[cardIndex];

  const saveSnapshot = useCallback(() => {
    return {
      cardIndex,
      stats: { ...stats },
      inventory: [...inventory],
    };
  }, [cardIndex, stats, inventory]);

  const restoreSnapshot = useCallback((snap) => {
    setCardIndex(snap.cardIndex);
    setStats({ ...snap.stats });
    setInventory([...snap.inventory]);
    setShowResult(null);
    setStatChanges(null);
    triggerFade();
  }, []);

  const triggerFade = () => {
    setFadeIn(false);
    setTimeout(() => setFadeIn(true), 50);
  };

  const startGame = () => {
    setCardIndex(0);
    setStats({
      life: INIT_STAT,
      stamina: INIT_STAT,
      mood: INIT_STAT,
      supplies: INIT_STAT,
    });
    setInventory([]);
    setHistory([]);
    setShowResult(null);
    setScreen("game");
    triggerFade();
  };

  const advanceCard = () => {
    if (showResult) {
      setShowResult(null);
      setStatChanges(null);
    }
    const nextIndex = cardIndex + 1;
    if (nextIndex >= TOTAL_CARDS) {
      setScreen("complete");
      return;
    }
    history.push(saveSnapshot());
    setHistory([...history]);
    setCardIndex(nextIndex);
    triggerFade();
  };

  const makeChoice = (choice) => {
    history.push(saveSnapshot());
    setHistory([...history]);

    const newStats = applyEffects(stats, choice.effects, inventory, choice);
    const changes = {};
    Object.keys(choice.effects).forEach((k) => {
      let total = choice.effects[k];
      if (choice.bonusIf && inventory.includes(choice.bonusIf.item)) {
        total += choice.bonusIf.bonus[k] || 0;
      }
      if (total !== 0) changes[k] = total;
    });

    setStats(newStats);
    setStatChanges(changes);

    const newInv = [...inventory];
    if (choice.giveItem && !newInv.includes(choice.giveItem)) {
      newInv.push(choice.giveItem);
    }
    if (choice.removeItem) {
      const idx = newInv.indexOf(choice.removeItem);
      if (idx >= 0) newInv.splice(idx, 1);
    }
    setInventory(newInv);

    setShowResult(choice.text);

    if (isGameOver(newStats)) {
      setTimeout(() => setScreen("gameover"), 1500);
    }
  };

  const goBack = (steps) => {
    const targetIdx = Math.max(0, history.length - steps);
    if (history[targetIdx]) {
      restoreSnapshot(history[targetIdx]);
      setHistory(history.slice(0, targetIdx));
    }
  };

  // Title screen
  if (screen === "title") {
    return (
      <div
        style={{
          minHeight: "100vh",
          width: "100%",
          maxWidth: 480,
          background: "linear-gradient(180deg, #0a0a0a 0%, #1a0505 50%, #0a0a0a 100%)",
          fontFamily: "'Noto Serif SC', 'STSong', 'SimSun', serif",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background texture */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,0,0,0.02) 2px, rgba(255,0,0,0.02) 4px)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "20%",
            left: "50%",
            transform: "translateX(-50%)",
            width: 300,
            height: 300,
            background: "radial-gradient(circle, rgba(139,0,0,0.15) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
          <div
            style={{
              fontSize: 14,
              color: "#8b0000",
              letterSpacing: "0.5em",
              marginBottom: 16,
              fontWeight: 300,
              paddingLeft: "0.5em", // 抵消末尾间距使文字居中
            }}
          >
            末日生存
          </div>
          <h1
            style={{
              fontSize: "clamp(32px, 10vw, 48px)",
              fontWeight: 900,
              color: "#e8e8e8",
              margin: "0 0 8px 0",
              letterSpacing: "0.2em",
              textShadow: "0 0 40px rgba(139,0,0,0.5)",
            }}
          >
            曙光营地
          </h1>
          <div
            style={{
              fontSize: 16,
              color: "#666",
              marginBottom: 48,
              letterSpacing: 4,
            }}
          >
            第一章 · 废墟之路
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              maxWidth: 280,
              margin: "0 auto 48px",
            }}
          >
            {Object.entries(STAT_DEFS).map(([key, def]) => (
              <div
                key={key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 10px",
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: 6,
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <span style={{ fontSize: 16 }}>{def.icon}</span>
                <span
                  style={{
                    fontSize: 12,
                    color: def.color,
                    fontWeight: 600,
                  }}
                >
                  {def.name}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: "#555",
                    marginLeft: "auto",
                  }}
                >
                  {INIT_STAT}/{MAX_STAT}
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={startGame}
            style={{
              padding: "14px 48px",
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: 6,
              background: "linear-gradient(135deg, #8b0000, #cc0000)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              transition: "all 0.3s",
              boxShadow: "0 0 30px rgba(139,0,0,0.4)",
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = "scale(1.05)";
              e.target.style.boxShadow = "0 0 50px rgba(139,0,0,0.6)";
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = "scale(1)";
              e.target.style.boxShadow = "0 0 30px rgba(139,0,0,0.4)";
            }}
          >
            开始旅程
          </button>

          <p
            style={{
              marginTop: 24,
              fontSize: 11,
              color: "#444",
              maxWidth: 300,
              lineHeight: 1.8,
            }}
          >
            四项属性归零即死亡 · 每个选择都有代价
            <br />
            保持均衡才能活到最后
          </p>
        </div>
      </div>
    );
  }

  // Game over screen
  if (screen === "gameover") {
    const deadKey = getDeadStat(stats);
    const deadDef = deadKey ? STAT_DEFS[deadKey] : null;
    const deathMessages = {
      life: "伤势过重，你倒在了通往曙光营地的路上。黑暗吞没了一切。",
      stamina: "你已经累到一步都走不动了。变异体的嚎叫越来越近……",
      mood: "绝望彻底击垮了你。你放下了武器，不想再挣扎了。",
      supplies: "没有食物，没有水。饥渴让你的意识一点点模糊……",
    };
    return (
      <div
        style={{
          minHeight: "100vh",
          width: "100%",
          maxWidth: 480,
          background: "linear-gradient(180deg, #0a0a0a, #1a0000)",
          fontFamily: "'Noto Serif SC', 'STSong', 'SimSun', serif",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 64, marginBottom: 16 }}>
          {deadDef?.icon || "💀"}
        </div>
        <h2
          style={{
            fontSize: 36,
            color: "#8b0000",
            fontWeight: 900,
            marginBottom: 16,
            letterSpacing: 8,
          }}
        >
          你死了
        </h2>
        <p
          style={{
            fontSize: 15,
            color: "#888",
            maxWidth: 320,
            lineHeight: 1.8,
            marginBottom: 8,
          }}
        >
          {deadKey && deathMessages[deadKey]}
        </p>
        <p style={{ fontSize: 13, color: "#555", marginBottom: 40 }}>
          {deadDef?.name}归零 · 卡片 {cardIndex + 1}/{TOTAL_CARDS}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {history.length >= 10 && (
            <button
              onClick={() => {
                goBack(10);
                setScreen("game");
              }}
              style={btnStyle("#444", "#ccc")}
            >
              回退10张卡片
            </button>
          )}
          {history.length >= 20 && (
            <button
              onClick={() => {
                goBack(20);
                setScreen("game");
              }}
              style={btnStyle("#444", "#ccc")}
            >
              回退20张卡片
            </button>
          )}
          <button onClick={startGame} style={btnStyle("#8b0000", "#fff")}>
            重新开始
          </button>
        </div>
      </div>
    );
  }

  // Chapter complete screen
  if (screen === "complete") {
    return (
      <div
        style={{
          minHeight: "100vh",
          width: "100%",
          maxWidth: 480,
          background: "linear-gradient(180deg, #0a0a0a 0%, #0a1a0a 50%, #0a0a0a 100%)",
          fontFamily: "'Noto Serif SC', 'STSong', 'SimSun', serif",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 64, marginBottom: 16 }}>🌅</div>
        <h2
          style={{
            fontSize: 32,
            color: "#f59e0b",
            fontWeight: 900,
            marginBottom: 8,
            letterSpacing: 6,
          }}
        >
          第一章 · 完
        </h2>
        <p
          style={{
            fontSize: 14,
            color: "#888",
            maxWidth: 320,
            lineHeight: 1.8,
            marginBottom: 32,
          }}
        >
          你活了下来，带着伙伴们到达了曙光营地的门口。但赵铁的威胁还没有结束，新的挑战还在等着你。
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            maxWidth: 260,
            marginBottom: 24,
          }}
        >
          {Object.entries(stats).map(([k, v]) => (
            <div
              key={k}
              style={{
                padding: "8px 12px",
                background: "rgba(255,255,255,0.04)",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.08)",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 20 }}>{STAT_DEFS[k].icon}</div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 900,
                  color: STAT_DEFS[k].color,
                }}
              >
                {v}
              </div>
              <div style={{ fontSize: 10, color: "#666" }}>
                {STAT_DEFS[k].name}
              </div>
            </div>
          ))}
        </div>
        {inventory.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
              持有道具
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              {inventory.map((id) => (
                <span
                  key={id}
                  style={{
                    padding: "4px 10px",
                    background: "rgba(245,158,11,0.1)",
                    border: "1px solid rgba(245,158,11,0.3)",
                    borderRadius: 6,
                    fontSize: 13,
                    color: "#f59e0b",
                  }}
                >
                  {ITEM_DEFS[id]?.icon} {ITEM_DEFS[id]?.name}
                </span>
              ))}
            </div>
          </div>
        )}
        <p style={{ fontSize: 13, color: "#f59e0b", letterSpacing: 4 }}>
          敬请期待第二章
        </p>
        <button
          onClick={startGame}
          style={{ ...btnStyle("#444", "#ccc"), marginTop: 24 }}
        >
          重新体验
        </button>
      </div>
    );
  }

  // === GAME SCREEN ===
  return (
    <div
      ref={containerRef}
      style={{
        minHeight: "100vh",
        width: "100%",
        maxWidth: 480,
        background: "linear-gradient(180deg, #0c0c0c, #141414)",
        fontFamily: "'Noto Serif SC', 'STSong', 'SimSun', serif",
        display: "flex",
        flexDirection: "column",
        color: "#d4d4d4",
        position: "relative",
      }}
    >
      {/* Top bar: stats */}
      <div
        style={{
          padding: "10px 12px 8px",
          background: "rgba(0,0,0,0.5)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <span
            style={{ fontSize: 11, color: "#666", fontFamily: "monospace" }}
          >
            {cardIndex + 1} / {TOTAL_CARDS}
          </span>
          <button
            onClick={() => setShowInventory(!showInventory)}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 6,
              padding: "3px 10px",
              fontSize: 12,
              color: "#999",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            🎒 {inventory.length}
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px 10px",
          }}
        >
          {Object.keys(STAT_DEFS).map((k) => (
            <StatBar key={k} statKey={k} value={stats[k]} />
          ))}
        </div>

        {/* Inventory dropdown */}
        {showInventory && (
          <div
            style={{
              marginTop: 8,
              padding: 10,
              background: "rgba(0,0,0,0.6)",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {inventory.length === 0 ? (
              <span style={{ fontSize: 12, color: "#555" }}>暂无道具</span>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {inventory.map((id) => (
                  <div
                    key={id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "4px 10px",
                      background: "rgba(245,158,11,0.08)",
                      border: "1px solid rgba(245,158,11,0.2)",
                      borderRadius: 6,
                    }}
                  >
                    <span style={{ fontSize: 14 }}>
                      {ITEM_DEFS[id]?.icon}
                    </span>
                    <span style={{ fontSize: 12, color: "#f59e0b" }}>
                      {ITEM_DEFS[id]?.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ height: 2, background: "#1a1a1a" }}>
        <div
          style={{
            height: "100%",
            width: `${((cardIndex + 1) / TOTAL_CARDS) * 100}%`,
            background: "linear-gradient(90deg, #8b0000, #cc3333)",
            transition: "width 0.5s ease",
          }}
        />
      </div>

      {/* Card content area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "24px 20px",
          maxWidth: 480,
          margin: "0 auto",
          width: "100%",
        }}
      >
        <div
          style={{
            opacity: fadeIn ? 1 : 0,
            transform: fadeIn ? "translateY(0)" : "translateY(12px)",
            transition: "all 0.4s ease",
          }}
        >
          {/* Main card text */}
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 12,
              padding: "28px 24px",
              marginBottom: 20,
              position: "relative",
            }}
          >
            {/* Card type badge */}
            {card?.type === "choice" && !showResult && (
              <div
                style={{
                  position: "absolute",
                  top: -10,
                  left: 20,
                  background: "#8b0000",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "2px 10px",
                  borderRadius: 4,
                  letterSpacing: 2,
                }}
              >
                抉择
              </div>
            )}

            {/* Item acquired badge */}
            {showResult &&
              card?.choices?.find((c) => c.text === showResult)?.giveItem && (
                <div
                  style={{
                    position: "absolute",
                    top: -10,
                    right: 20,
                    background: "rgba(245,158,11,0.9)",
                    color: "#000",
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "2px 10px",
                    borderRadius: 4,
                    letterSpacing: 1,
                  }}
                >
                  获得道具：
                  {
                    ITEM_DEFS[
                      card.choices.find((c) => c.text === showResult).giveItem
                    ]?.name
                  }{" "}
                  {
                    ITEM_DEFS[
                      card.choices.find((c) => c.text === showResult).giveItem
                    ]?.icon
                  }
                </div>
              )}

            <p
              style={{
                fontSize: 15,
                lineHeight: 2,
                color: showResult ? "#ccc" : "#d4d4d4",
                margin: 0,
                whiteSpace: "pre-wrap",
              }}
            >
              {showResult || card?.text}
            </p>
          </div>

          {/* Stat change - shown below result text */}
          {statChanges && (
            <div
              style={{
                marginBottom: 16,
                textAlign: "center",
                fontSize: 13,
                lineHeight: 1.8,
                color: "#999",
              }}
            >
              {Object.entries(statChanges).map(([k, v]) => {
                const def = STAT_DEFS[k];
                const positive = v > 0;
                return (
                  <span key={k} style={{
                    marginRight: 12,
                    color: positive ? "#4ade80" : "#f87171",
                  }}>
                    {def.name}{positive ? "+" : ""}{v}
                  </span>
                );
              })}
              {showResult && (() => {
                const currentChoice = card?.choices?.find(c => c.text === showResult);
                if (currentChoice?.bonusIf && inventory.includes(currentChoice.bonusIf.item)) {
                  return (
                    <span style={{ color: "#f59e0b", marginLeft: 4 }}>
                      （{ITEM_DEFS[currentChoice.bonusIf.item]?.name}发挥了作用！）
                    </span>
                  );
                }
                return null;
              })()}
            </div>
          )}

          {/* Choices or advance button */}
          {card?.type === "choice" && !showResult ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {card.choices.map((choice, i) => (
                <button
                  key={i}
                  onClick={() => makeChoice(choice)}
                  style={{
                    padding: "14px 18px",
                    background:
                      i === 0
                        ? "rgba(139,0,0,0.15)"
                        : "rgba(59,130,246,0.1)",
                    border: `1px solid ${i === 0 ? "rgba(139,0,0,0.4)" : "rgba(59,130,246,0.3)"}`,
                    borderRadius: 10,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.2s",
                    fontFamily: "inherit",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateX(4px)";
                    e.currentTarget.style.borderColor =
                      i === 0 ? "rgba(139,0,0,0.8)" : "rgba(59,130,246,0.6)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateX(0)";
                    e.currentTarget.style.borderColor =
                      i === 0
                        ? "rgba(139,0,0,0.4)"
                        : "rgba(59,130,246,0.3)";
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: i === 0 ? "#ef4444" : "#60a5fa",
                      }}
                    >
                      {i === 0 ? "A" : "B"}. {choice.label}
                    </span>
                    {choice.giveItem && (
                      <span style={{ fontSize: 12, color: "#f59e0b" }}>
                        {ITEM_DEFS[choice.giveItem]?.icon}
                      </span>
                    )}
                  </div>
                  
                </button>
              ))}
            </div>
          ) : (
            <button
              onClick={advanceCard}
              style={{
                width: "100%",
                padding: "14px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10,
                color: "#888",
                fontSize: 14,
                cursor: "pointer",
                transition: "all 0.2s",
                fontFamily: "inherit",
                letterSpacing: 2,
              }}
              onMouseEnter={(e) => {
                e.target.style.background = "rgba(255,255,255,0.08)";
                e.target.style.color = "#ccc";
              }}
              onMouseLeave={(e) => {
                e.target.style.background = "rgba(255,255,255,0.04)";
                e.target.style.color = "#888";
              }}
            >
              {showResult
                ? "继续 →"
                : cardIndex >= TOTAL_CARDS - 1
                  ? "完成第一章"
                  : "下一页 →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Shared styles
const btnStyle = (bg, color) => ({
  padding: "12px 36px",
  fontSize: 15,
  fontWeight: 700,
  letterSpacing: 3,
  background: bg,
  color: color,
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontFamily: "'Noto Serif SC', 'STSong', serif",
  transition: "all 0.2s",
});


