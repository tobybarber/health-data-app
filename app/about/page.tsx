'use client';

import { useAuth } from '../lib/AuthContext';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '../components/Navigation';

export default function AboutPage() {
  const { currentUser } = useAuth();
  const router = useRouter();

  return (
    <>
      <div className="p-6 pt-20">
        <Navigation isHomePage={true} />
        
        <div className="bg-black/90 backdrop-blur-sm p-6 rounded-md shadow-md mb-6 border border-gray-800">
          <h1 className="text-3xl font-bold text-primary-blue mb-6">About Wattle</h1>
          
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-primary-blue mb-4">Our Mission</h2>
            <p className="mb-4 text-gray-300">
              Wattle is dedicated to empowering individuals to take control of their health data. 
              We provide a secure platform for storing, managing, and analyzing your health records, 
              enabling you to make informed decisions about your healthcare journey.
            </p>
            <p className="text-gray-300">
              Our goal is to bridge the gap between various healthcare providers and systems, 
              creating a unified view of your health information that is accessible whenever you need it.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-primary-blue mb-4">Privacy Commitment</h2>
            <p className="mb-4 text-gray-300">
              At Wattle, we understand that your health data is extremely personal and sensitive. 
              We are committed to maintaining the highest standards of privacy and confidentiality.
            </p>
            <div className="bg-gray-900 p-4 rounded-lg mb-4">
              <h3 className="font-semibold mb-2 text-gray-300">Our Privacy Principles:</h3>
              <ul className="list-disc pl-5 space-y-2 text-gray-300">
                <li>Your data belongs to you. You maintain ownership and control of your health information at all times.</li>
                <li>We never sell or share your personal health information with third parties without your explicit consent.</li>
                <li>You can delete your data at any time.</li>
                <li>We only collect information that is necessary to provide our services.</li>
                <li>We are transparent about how your data is used within our platform.</li>
              </ul>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-primary-blue mb-4">Security Measures</h2>
            <p className="mb-4 text-gray-800">
              Protecting your health data is our top priority. We implement industry-leading security 
              measures to ensure your information remains safe.
            </p>
            <div className="bg-blue-50 p-4 rounded-lg mb-4">
              <h3 className="font-semibold mb-2 text-gray-800">Our Security Infrastructure:</h3>
              <ul className="list-disc pl-5 space-y-2 text-gray-800">
                <li>End-to-end encryption for all sensitive data</li>
                <li>Secure authentication with multi-factor options</li>
                <li>Regular security audits and vulnerability testing</li>
                <li>Compliance with healthcare data protection regulations</li>
                <li>Secure cloud infrastructure with redundant backups</li>
                <li>Continuous monitoring for unauthorized access attempts</li>
              </ul>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-primary-blue mb-4">Data Handling Practices</h2>
            <p className="mb-4 text-gray-800">
              We adhere to strict data handling practices to maintain the integrity and confidentiality of your information:
            </p>
            <ul className="list-disc pl-5 space-y-2 mb-4 text-gray-800">
              <li>All data is encrypted both in transit and at rest</li>
              <li>Access to user data is strictly limited and logged</li>
              <li>Regular data protection impact assessments</li>
              <li>Clear data retention policies</li>
              <li>Secure data deletion processes when requested</li>
            </ul>
            <p className="text-gray-800">
              For more detailed information about how we handle your data, please review our 
              comprehensive Privacy Policy and Terms of Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-primary-blue mb-4">Contact Us</h2>
            <p className="mb-4 text-gray-800">
              If you have any questions or concerns about privacy, security, or any other aspect of our service, 
              please don't hesitate to contact our support team.
            </p>
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="font-semibold text-gray-800">Email: support@wattle-health.com</p>
              <p className="font-semibold text-gray-800">Phone: +61 421 479 656</p>
            </div>
          </section>
        </div>
      </div>
    </>
  );
} 