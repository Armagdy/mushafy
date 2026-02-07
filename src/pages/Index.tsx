import Header from '@/components/Header';
import Hero from '@/components/Hero';
import SurahList from '@/components/SurahList';
import Footer from '@/components/Footer';

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <Hero />
        <SurahList />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
