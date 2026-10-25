[中文](#cn-v1.0.2) | [English](#en-v1.0.2)

<h3 id="cn-v1.0.2">中文</h3>

🎯 **会话目录定位修正**

删除对话时，会话目录的定位以会话日志头部记录的编号为准。同一编号对应多个会话目录时，优先删除目录名与所传编号完全一致者；无法确定唯一目标时拒绝删除并报错，不改动任何数据。

- 新增错误码 `E_AMBIGUOUS_TARGET`，同一编号对应多个会话目录时拒绝删除
- 空目录仅删除自身，不按编号展开子代理会话

<h3 id="en-v1.0.2">English</h3>

🎯 **Session directory resolution**

The session directory is now located by the id recorded in the session log header. When one id maps to several session directories, the directory whose name equals the requested id exactly is deleted; if no unique target can be determined, deletion is refused with an error and no data is changed.

- New error code `E_AMBIGUOUS_TARGET`, returned when one id maps to several session directories
- An empty directory is deleted on its own and no longer expanded by id
