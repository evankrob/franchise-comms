'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

interface Location {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  phone?: string;
  email?: string;
  status: string;
  created_at: string;
}

export default function LocationsPage({ params }: { params: { slug: string } }) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/locations');
      if (!response.ok) {
        throw new Error('Failed to fetch locations');
      }
      const result = await response.json();
      setLocations(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading locations...</p>
        </div>
      </div>
    );
  }

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
                Posts
              </Link>
              <Link 
                href={`/tenant/${params.slug}/members`}
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Members
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
      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Locations</h1>
              <p className="mt-2 text-gray-600">
                Manage your franchise locations and their settings.
              </p>
            </div>
            <Link
              href={`/tenant/${params.slug}/locations/new`}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              <span className="mr-2">+</span>
              Add Location
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Locations Grid */}
        {locations.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-4xl">📍</span>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No locations yet</h3>
            <p className="text-gray-600 mb-6">
              Get started by creating your first franchise location.
            </p>
            <Link
              href={`/tenant/${params.slug}/locations/new`}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              <span className="mr-2">+</span>
              Create Your First Location
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {locations.map((location) => (
              <div key={location.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-gray-900 mb-1">
                      {location.name}
                    </h3>
                    <div className="flex items-center space-x-2">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          location.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {location.status === 'active' ? '🟢' : '🔴'} {location.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-gray-600 mb-4">
                  <p className="flex items-start">
                    <span className="mr-2">📍</span>
                    <span>
                      {location.address}<br />
                      {location.city}, {location.state} {location.zip_code}
                    </span>
                  </p>
                  {location.phone && (
                    <p className="flex items-center">
                      <span className="mr-2">📞</span>
                      <span>{location.phone}</span>
                    </p>
                  )}
                  {location.email && (
                    <p className="flex items-center">
                      <span className="mr-2">📧</span>
                      <span>{location.email}</span>
                    </p>
                  )}
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center justify-between">
                    <Link
                      href={`/location/${location.id}/dashboard`}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      View Dashboard →
                    </Link>
                    <div className="flex items-center space-x-2">
                      <button className="text-gray-400 hover:text-gray-600 text-sm">
                        ⚙️ Settings
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-2 text-xs text-gray-400">
                  Created {new Date(location.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary Stats */}
        {locations.length > 0 && (
          <div className="mt-12 bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Location Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">{locations.length}</div>
                <div className="text-sm text-gray-600">Total Locations</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">
                  {locations.filter(l => l.status === 'active').length}
                </div>
                <div className="text-sm text-gray-600">Active Locations</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-400">
                  {locations.filter(l => l.status !== 'active').length}
                </div>
                <div className="text-sm text-gray-600">Inactive Locations</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}