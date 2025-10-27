#!/usr/bin/env python3
"""
自动化部署脚本 - double-ninth-festival
"""

import subprocess
import sys
import os
from typing import List, Optional

class DeployConfig:
    """部署配置"""
    # 服务器配置
    SERVER_ALIAS = "personalize"

    SERVER_PORT = "22"
    SERVER_USER = "root"
    
    # 部署路径
    REMOTE_PATH = "/data/double-ninth-festival"
    LOCAL_PATH = "./"
    
    # 排除的文件/目录
    EXCLUDE_PATTERNS = [
        '.next',
        'node_modules', 
        '.git',
        '__pycache__',
        '*.pyc',
        '.env.local',
        '.DS_Store'
    ]
    
    # 远程执行的命令
    REMOTE_COMMANDS = [
        "cd /data/double-ninth-festival",
        "pnpm i",
        "npx prisma db push",
        "pnpm build",
        "pm2 restart double-ninth-festival"
    ]

class Colors:
    """终端颜色"""
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_step(step: str, message: str):
    """打印步骤信息"""
    print(f"{Colors.HEADER}{Colors.BOLD}[{step}]{Colors.ENDC} {message}")

def print_success(message: str):
    """打印成功信息"""
    print(f"{Colors.OKGREEN}✓ {message}{Colors.ENDC}")

def print_error(message: str):
    """打印错误信息"""
    print(f"{Colors.FAIL}✗ {message}{Colors.ENDC}")

def print_warning(message: str):
    """打印警告信息"""
    print(f"{Colors.WARNING}⚠ {message}{Colors.ENDC}")

def run_command(command: str, check: bool = True, shell: bool = True) -> subprocess.CompletedProcess:
    """执行命令"""
    print(f"{Colors.OKCYAN}$ {command}{Colors.ENDC}")
    try:
        result = subprocess.run(
            command, 
            shell=shell, 
            check=check, 
            capture_output=True, 
            text=True
        )
        if result.stdout:
            print(result.stdout.strip())
        return result
    except subprocess.CalledProcessError as e:
        print_error(f"命令执行失败: {e}")
        if e.stderr:
            print(e.stderr.strip())
        raise

def check_dependencies():
    """检查依赖"""
    print_step("1", "检查依赖...")
    
    dependencies = ['rsync', 'ssh']
    missing = []
    
    for dep in dependencies:
        try:
            subprocess.run(['which', dep], check=True, capture_output=True)
            print_success(f"{dep} 已安装")
        except subprocess.CalledProcessError:
            missing.append(dep)
            print_error(f"{dep} 未找到")
    
    if missing:
        print_error(f"缺少依赖: {', '.join(missing)}")
        print("请安装缺少的依赖后重试")
        sys.exit(1)

def sync_files():
    """同步文件到服务器"""
    print_step("2", "同步文件到服务器...")
    
    # 构建排除参数
    exclude_args = []
    for pattern in DeployConfig.EXCLUDE_PATTERNS:
        exclude_args.extend(['--exclude', pattern])
    
    # 构建rsync命令
    rsync_cmd = [
        'rsync',
        '-avz',
        '--delete',
        *exclude_args,
        DeployConfig.LOCAL_PATH,
        f"{DeployConfig.SERVER_ALIAS}:{DeployConfig.REMOTE_PATH}"
    ]
    
    try:
        result = subprocess.run(rsync_cmd, check=True, text=True)
        print_success("文件同步完成")
    except subprocess.CalledProcessError as e:
        print_error(f"文件同步失败: {e}")
        raise

def execute_remote_commands():
    """在远程服务器执行命令"""
    print_step("3", "在远程服务器执行部署命令...")
    
    # 将所有命令连接成一个命令字符串
    combined_commands = " && ".join(DeployConfig.REMOTE_COMMANDS)
    
    ssh_cmd = [
        'ssh',
        DeployConfig.SERVER_ALIAS,
        combined_commands
    ]
    
    try:
        result = subprocess.run(ssh_cmd, check=True, text=True)
        print_success("远程命令执行完成")
    except subprocess.CalledProcessError as e:
        print_error(f"远程命令执行失败: {e}")
        raise

def check_ssh_connection():
    """检查SSH连接"""
    print_step("0", "检查SSH连接...")
    
    try:
        result = subprocess.run(
            ['ssh', '-o', 'ConnectTimeout=10', DeployConfig.SERVER_ALIAS, 'echo "连接成功"'],
            check=True,
            capture_output=True,
            text=True
        )
        print_success("SSH连接正常")
    except subprocess.CalledProcessError:
        print_error("SSH连接失败")
        print_warning("请确保:")
        print("  1. SSH配置正确 (~/.ssh/config)")
        print("  2. 服务器可访问")
        print("  3. 密钥认证已设置")
        sys.exit(1)

def main():
    """主函数"""
    print(f"{Colors.HEADER}{Colors.BOLD}")
    print("=" * 50)
    print("  double ninth 自动化部署脚本")
    print("=" * 50)
    print(f"{Colors.ENDC}")
    
    try:
        # 检查依赖
        check_dependencies()
        
        # 检查SSH连接
        check_ssh_connection()
        
        # 确认部署
        print(f"\n{Colors.WARNING}即将部署到服务器: {DeployConfig.SERVER_ALIAS}{Colors.ENDC}")

        print()
        
        # 同步文件
        sync_files()
        
        print()
        
        # 执行远程命令
        execute_remote_commands()
        
        print()
        print_success("🎉 部署完成!")
        
    except KeyboardInterrupt:
        print(f"\n{Colors.WARNING}部署被用户中断{Colors.ENDC}")
        sys.exit(1)
    except Exception as e:
        print_error(f"部署失败: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 