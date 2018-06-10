- size
- once
- pick(object, *keys | Function) 
返回一个object副本，只过滤出keys(有效的键组成的数组)参数指定的属性值。或者接受一个判断函数，指定挑选哪个key。
- omit 与pick作用相反，过滤掉指定的key，返回一个对象包含剩余的key
- result(object, property, [defaultValue]) 提取obj[property]，如果property为函数则返回执行结果 
- functions(obj) 返回对象里所有的方法名 Array
- escape转义
- iteratee 
- isEmpty
_ isEqual 执行两个对象之间的优化深度比较，确定他们是否应被视为相等。