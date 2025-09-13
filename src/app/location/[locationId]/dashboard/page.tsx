import Link from 'next/link';

export default function LocationDashboard({ params }: { params: { locationId: string } }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                Location Dashboard
              </h1>
              <span className="ml-2 text-sm text-gray-500">
                ID: {params.locationId}
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <Link 
                href={`/location/${params.locationId}/posts`}
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                All Posts
              </Link>
              <Link 
                href={`/location/${params.locationId}/staff`}
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Staff
              </Link>
              <Link 
                href={`/location/${params.locationId}/reports`}
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Reports
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
      <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Location Info Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Downtown Location</h2>
              <p className="text-gray-600 mt-1">123 Main Street, Downtown, NY 10001</p>
              <p className="text-gray-600">(555) 123-4567 • downtown@franchise.com</p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Active
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Franchise Owner
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Posts Feed */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Recent Messages & Announcements</h3>
                <p className="text-sm text-gray-600">Posts targeted to your location</p>
              </div>
              
              <div className="divide-y divide-gray-200">
                {/* Sample Post 1 - Announcement */}
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-semibold text-sm">📢</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="text-sm font-medium text-gray-900">New Health & Safety Protocols</h4>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                            Announcement
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">From: Corporate Team • 2 hours ago</p>
                        <p className="text-sm text-gray-700 mt-2">
                          Please review the updated health and safety protocols effective immediately. 
                          All staff should be briefed on the new procedures by end of week.
                        </p>
                        <div className="flex items-center space-x-4 mt-3">
                          <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                            👍 12 • Mark as Read
                          </button>
                          <button className="text-sm text-gray-500 hover:text-gray-700">
                            💬 3 Comments
                          </button>
                          <button className="text-sm text-gray-500 hover:text-gray-700">
                            📎 2 Attachments
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sample Post 2 - Performance Update */}
                <div className="p-6 bg-green-50">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-green-600 font-semibold text-sm">📊</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="text-sm font-medium text-gray-900">Great Quarter Performance!</h4>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          Performance Update
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">From: Regional Manager • 1 day ago</p>
                      <p className="text-sm text-gray-700 mt-2">
                        Congratulations! Your location exceeded sales targets by 15% this quarter. 
                        Keep up the excellent work team!
                      </p>
                      <div className="flex items-center space-x-4 mt-3">
                        <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                          ❤️ 25 • Mark as Read
                        </button>
                        <button className="text-sm text-gray-500 hover:text-gray-700">
                          💬 8 Comments
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sample Post 3 - Request */}
                <div className="p-6">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                      <span className="text-orange-600 font-semibold text-sm">📋</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="text-sm font-medium text-gray-900">Monthly Inventory Report Due</h4>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                          Request
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                          Due: March 31
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">From: Operations Team • 3 days ago</p>
                      <p className="text-sm text-gray-700 mt-2">
                        Please submit your monthly inventory report by March 31st. 
                        Use the updated template attached to this message.
                      </p>
                      <div className="flex items-center space-x-4 mt-3">
                        <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                          📤 Submit Report
                        </button>
                        <button className="text-sm text-gray-500 hover:text-gray-700">
                          💬 2 Comments
                        </button>
                        <button className="text-sm text-gray-500 hover:text-gray-700">
                          📎 Template Download
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sample Post 4 - General Message */}
                <div className="p-6">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                      <span className="text-gray-600 font-semibold text-sm">💬</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="text-sm font-medium text-gray-900">Team Building Event Next Friday</h4>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                          Message
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">From: HR Team • 1 week ago</p>
                      <p className="text-sm text-gray-700 mt-2">
                        Join us for a team building lunch next Friday at 12 PM. 
                        RSVP by Wednesday so we can make reservations.
                      </p>
                      <div className="flex items-center space-x-4 mt-3">
                        <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                          ✅ RSVP
                        </button>
                        <button className="text-sm text-gray-500 hover:text-gray-700">
                          💬 15 Comments
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-200">
                <Link 
                  href={`/location/${params.locationId}/posts`}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  View All Posts →
                </Link>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Stats</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Unread Messages</span>
                  <span className="text-lg font-semibold text-red-600">3</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Pending Actions</span>
                  <span className="text-lg font-semibold text-orange-600">2</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Staff Members</span>
                  <span className="text-lg font-semibold text-gray-900">12</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">This Month Posts</span>
                  <span className="text-lg font-semibold text-gray-900">18</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <Link 
                  href={`/location/${params.locationId}/reports/new`}
                  className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  📊 Submit Report
                </Link>
                <Link 
                  href={`/location/${params.locationId}/posts/compose`}
                  className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  💬 Message Staff
                </Link>
                <Link 
                  href={`/location/${params.locationId}/staff/invite`}
                  className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  👥 Invite Staff
                </Link>
              </div>
            </div>

            {/* Urgent Items */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-red-900 mb-4">🚨 Urgent Items</h3>
              <div className="space-y-3">
                <div className="text-sm">
                  <p className="font-medium text-red-900">Monthly Inventory Report</p>
                  <p className="text-red-700">Due in 3 days</p>
                </div>
                <div className="text-sm">
                  <p className="font-medium text-red-900">Safety Training Completion</p>
                  <p className="text-red-700">2 staff members pending</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}