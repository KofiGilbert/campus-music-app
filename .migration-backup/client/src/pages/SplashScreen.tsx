import { Card, CardContent } from "@/components/ui/card";

const splashLogo = {
  alt: "Campus music logo",
  src: "/figmaAssets/campus-music-logo-1.png",
};

export const SplashScreen = (): JSX.Element => {
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-[#e9e9e9] px-6">
      <Card className="h-auto border-0 bg-transparent shadow-none">
        <CardContent className="flex items-center justify-center p-0">
          <img
            className="h-auto w-[140px] max-w-full object-contain sm:w-[150px]"
            alt={splashLogo.alt}
            src={splashLogo.src}
          />
        </CardContent>
      </Card>
    </main>
  );
};
