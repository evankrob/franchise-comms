import Link from 'next/link';

export default function NewPost({ params }: { params: { slug: string } }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link 
                href={`/tenant/${params.slug}/dashboard`}
                className="text-xl font-semibold text-gray-900 hover:text-gray-700"
              >
                ← {params.slug}
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link 
                href={`/tenant/${params.slug}/posts`}
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                All Posts
              </Link>
              <Link 
                href={`/tenant/${params.slug}/dashboard`}
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">Create New Post</h1>
            <p className="mt-1 text-gray-600">Share an announcement, update, or message with your organization.</p>
          </div>
          
          <form className="p-6 space-y-6">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Post Title
              </label>
              <input
                type="text"
                id="title"
                name="title"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter a title for your post..."
              />
            </div>

            <div>
              <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
                Content
              </label>
              <textarea
                id="content"
                name="content"
                rows={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="Write your post content here..."
              />
            </div>

            <div>
              <label htmlFor="locations" className="block text-sm font-medium text-gray-700 mb-2">
                Target Locations (Optional)
              </label>
              <select
                id="locations"
                name="locations"
                multiple
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Locations</option>
                <option value="location1">Location 1 (Coming Soon)</option>
                <option value="location2">Location 2 (Coming Soon)</option>
              </select>
              <p className="mt-1 text-sm text-gray-500">
                Hold Ctrl/Cmd to select multiple locations. Leave empty to send to all locations.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Post Type
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="post_type"
                    value="announcement"
                    defaultChecked
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">📢 Announcement</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="post_type"
                    value="update"
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">📋 Update</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="post_type"
                    value="general"
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">💬 General</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <Link
                href={`/tenant/${params.slug}/dashboard`}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </Link>
              <div className="space-x-3">
                <button
                  type="button"
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Save Draft
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Publish Post
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}