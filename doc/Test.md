- 查看覆盖率
npm run test -- --coverage
注意:测试脚本和功能脚本要分开两个文件(greeter_view.test.js、greeter_view.js)，否则将显示不了覆盖率

查看报告
- 绿色表示覆盖运行的次数
- 红色表示未覆盖到语句

## TODO
- snapshot

## 坑
jest调试命令 node --inspect --inspect-brk node_modules/bin/jest 要在node 8.4以上运行才有效。webstorm调试内部也是调用了这个命令，所以系统安装的node版本一定要注意