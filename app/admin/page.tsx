"use client";

import { useState, useEffect } from "react";

interface PhotoRecord {
  id: number;
  phone: string;
  originalUrl: string;
  restoredUrl: string;
  status: string;
  createdAt: string;
}

interface PoemRecord {
  id: number;
  phone: string;
  title: string;
  content: string;
  imageUrl: string;
  status: string;
  createdAt: string;
}

interface Stats {
  totalPhotoRecords: number;
  successfulPhotoRecords: number;
  totalPoemRecords: number;
  successfulPoemRecords: number;
}

interface AdminData {
  photoRecords: PhotoRecord[];
  poemRecords: PoemRecord[];
  stats: Stats;
}

export default function AdminPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"photos" | "poems" | "stats">("stats");

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      const response = await fetch("/api/admin");
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error("Failed to fetch admin data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">加载中...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-red-600">加载失败，请刷新页面</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">管理后台</h1>
        
        {/* 标签页导航 */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab("stats")}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "stats"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                统计信息
              </button>
              <button
                onClick={() => setActiveTab("photos")}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "photos"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                照片修复记录 ({data.photoRecords.length})
              </button>
              <button
                onClick={() => setActiveTab("poems")}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "poems"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                诗歌生成记录 ({data.poemRecords.length})
              </button>
            </nav>
          </div>
        </div>

        {/* 统计信息 */}
        {activeTab === "stats" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900">总照片记录</h3>
              <p className="text-3xl font-bold text-blue-600">{data.stats.totalPhotoRecords}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900">成功修复</h3>
              <p className="text-3xl font-bold text-green-600">{data.stats.successfulPhotoRecords}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900">总诗歌记录</h3>
              <p className="text-3xl font-bold text-purple-600">{data.stats.totalPoemRecords}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900">成功生成</h3>
              <p className="text-3xl font-bold text-orange-600">{data.stats.successfulPoemRecords}</p>
            </div>
          </div>
        )}

        {/* 照片修复记录 */}
        {activeTab === "photos" && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">照片修复记录</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">手机号</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">创建时间</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">原图</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">修复图</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.photoRecords.map((record) => (
                    <tr key={record.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.phone}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          record.status === "success" 
                            ? "bg-green-100 text-green-800" 
                            : record.status === "failed"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(record.createdAt).toLocaleString("zh-CN")}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.originalUrl && (
                          <img
                            src={record.originalUrl} 
                          />
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {record.restoredUrl && (
                          <img
                            src={record.restoredUrl} 
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 诗歌生成记录 */}
        {activeTab === "poems" && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">诗歌生成记录</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">手机号</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">标题</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">创建时间</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.poemRecords.map((record) => (
                    <tr key={record.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{record.phone}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 max-w-xs truncate">
                        {record.title}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          record.status === "success" 
                            ? "bg-green-100 text-green-800" 
                            : record.status === "failed"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(record.createdAt).toLocaleString("zh-CN")}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <a 
                          href={`/share/poem/${record.id}`}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800"
                        >
                          查看详情
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}