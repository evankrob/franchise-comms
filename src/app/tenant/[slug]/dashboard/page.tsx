import Link from 'next/link';

export default function TenantDashboard({ params }: { params: { slug: string } }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                {params.slug}
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link 
                href={`/tenant/${params.slug}/posts`}
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Posts
              </Link>
              <Link 
                href={`/tenant/${params.slug}/members`}
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Members
              </Link>
              <Link 
                href={`/tenant/${params.slug}/locations`}
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Locations
              </Link>
              <Link 
                href={`/tenant/${params.slug}/settings`}
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Settings
              </Link>
              <Link 
                href="/auth/logout"
                className="bg-gray-900 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700"
              >
                Logout
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm p-8">
          <div className="border-b border-gray-200 pb-6 mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome to your Dashboard
            </h1>
            <p className="mt-2 text-gray-600">
              Organization: <span className="font-semibold">{params.slug}</span>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">
                🎉 Setup Complete!
              </h3>
              <p className="text-blue-700">
                Your organization has been successfully created and you&apos;ve been set up as the admin.
              </p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-green-900 mb-2">
                📊 API Ready
              </h3>
              <p className="text-green-700">
                12 comprehensive API endpoints are available for posts, comments, reactions, and more.
              </p>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-purple-900 mb-2">
                🔒 Security Enabled
              </h3>
              <p className="text-purple-700">
                Multi-tenant Row Level Security is active to protect your data.
              </p>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Quick Actions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link 
                href={`/tenant/${params.slug}/members`}
                className="block p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all"
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 text-sm font-semibold">👥</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Invite Team Members</h4>
                    <p className="text-sm text-gray-600 mt-1">Add users to your organization and assign roles.</p>
                    <span className="text-blue-600 text-sm font-medium mt-2 inline-block">Manage Members →</span>
                  </div>
                </div>
              </Link>
              
              <Link 
                href={`/tenant/${params.slug}/locations`}
                className="block p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all"
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 text-sm font-semibold">📍</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Create Locations</h4>
                    <p className="text-sm text-gray-600 mt-1">Set up franchise locations for targeted communications.</p>
                    <span className="text-blue-600 text-sm font-medium mt-2 inline-block">Manage Locations →</span>
                  </div>
                </div>
              </Link>
              
              <Link 
                href={`/tenant/${params.slug}/posts`}
                className="block p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all"
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 text-sm font-semibold">📝</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Start Communicating</h4>
                    <p className="text-sm text-gray-600 mt-1">Create posts, announcements, and manage communications.</p>
                    <span className="text-blue-600 text-sm font-medium mt-2 inline-block">View Posts →</span>
                  </div>
                </div>
              </Link>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                🚀 Platform Ready!
              </h3>
              <p className="text-gray-700 mb-4">
                Your franchise communications platform is fully functional with comprehensive APIs, 
                secure authentication, and scalable architecture.
              </p>
              <Link 
                href={`/tenant/${params.slug}/posts/new`}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
              >
                Create Your First Post
              </Link>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-3">
                📡 API Endpoints Available
              </h3>
              <p className="text-blue-700 mb-3">
                12 comprehensive endpoints for full platform functionality:
              </p>
              <ul className="text-sm text-blue-600 space-y-1">
                <li>• Posts, Comments & Reactions</li>
                <li>• File Attachments & Downloads</li>
                <li>• User Management & Notifications</li>
                <li>• Tenant & Location Management</li>
              </ul>
              <Link 
                href={`/tenant/${params.slug}/api-docs`}
                className="inline-flex items-center mt-3 text-blue-600 text-sm font-medium hover:text-blue-800"
              >
                View API Documentation →
              </Link>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}