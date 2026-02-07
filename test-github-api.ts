// Test script to fetch image from GitHub
// For private repos, set your GitHub token here or in environment variable
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || ''; // Get from https://github.com/settings/tokens

async function testFetchImage() {
  try {
    // Method 1: Using GitHub API
    console.log('--- Method 1: GitHub API ---');
    const headers: HeadersInit = GITHUB_TOKEN 
      ? { 'Authorization': `Bearer ${GITHUB_TOKEN}` }
      : {};
    
    const apiResponse = await fetch(
      'https://api.github.com/repos/Armagdy/test/contents/page_0001.jpg',
      { headers }
    );
    const metadata = await apiResponse.json();

    console.log('File name:', metadata.name);
    console.log('File size:', metadata.size, 'bytes');
    console.log('Download URL:', metadata.download_url);
    console.log('File SHA:', metadata.sha);

    // Method 2: Direct fetch from raw.githubusercontent.com
    console.log('\n--- Method 2: Direct Raw URL ---');
    const rawUrl = 'https://raw.githubusercontent.com/Armagdy/test/main/page_0001.jpg';
    const imageResponse = await fetch(rawUrl, { headers });
    
    if (imageResponse.ok) {
      const blob = await imageResponse.blob();
      console.log('Image fetched successfully!');
      console.log('Content-Type:', imageResponse.headers.get('content-type'));
      console.log('Size:', blob.size, 'bytes');
      
      // You can create an object URL to use the image
      // const imageUrl = URL.createObjectURL(blob);
      // console.log('Object URL:', imageUrl);
    } else {
      console.error('Failed to fetch image:', imageResponse.status);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testFetchImage();
