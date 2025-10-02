# \## Quick Start (Dev)

# 

# 1\) 安装依赖  

# &nbsp;  pnpm i

# 

# 2\) 准备环境变量（本地用 Mock 即可）  

# &nbsp;  复制：apps/api/.env.example → apps/api/.env

# 

# 3\) 启动后端（另开窗口可跑自检）  

# &nbsp;  pnpm -F @wxresume/api dev

# 

# 4\) 一键自检（需已启动后端）  

# &nbsp;  %USERPROFILE%\\wxresume\\scripts\\smoke.cmd



# wxresume

Quick Start:

1. pnpm i
2. cp apps/api/.env.example apps/api/.env
3. pnpm dev:api
4. curl http://localhost:8080/v1/health
   Repo Layout:

* apps/api: Node API
* packages/templates: resume templates
* data: JD dictionary
* samples: sample data

## Notion Links

* 接口联调记录: https://www.notion.so/2804168855f7801c9615e58baf525c49?source=copy\_link
* 运行期配置: https://www.notion.so/2804168855f780c8bdf5ec7e92ed8199?source=copy\_link
* 样例数据（联调包）: https://www.notion.so/2804168855f7802aa261de6d19fe82c8?source=copy\_link
* Postman: apps/api/postman/wxresume.postman\_collection.json
