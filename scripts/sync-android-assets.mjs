import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const androidResDir = path.resolve(projectRoot, '..', 'Tessera Browser', 'app', 'src', 'main', 'res');
const drawableDir = path.join(androidResDir, 'drawable');
const mipmapDir = path.join(androidResDir, 'mipmap-xxxhdpi');

const publicAssetsDir = path.join(projectRoot, 'public', 'assets');
const brandsOutDir = path.join(publicAssetsDir, 'brands');
const wallpapersOutDir = path.join(publicAssetsDir, 'wallpapers');
const buildDir = path.join(projectRoot, 'build');

fs.mkdirSync(brandsOutDir, { recursive: true });
fs.mkdirSync(wallpapersOutDir, { recursive: true });
fs.mkdirSync(buildDir, { recursive: true });

function convertAndroidVectorToSvg(xmlContent) {
  const vwMatch = xmlContent.match(/android:viewportWidth="([^"]+)"/);
  const vhMatch = xmlContent.match(/android:viewportHeight="([^"]+)"/);
  const vw = vwMatch ? vwMatch[1] : '24';
  const vh = vhMatch ? vhMatch[1] : '24';

  const paths = [];
  const pathRegex = /<path\b([\s\S]*?)\/>/g;
  let match;
  while ((match = pathRegex.exec(xmlContent)) !== null) {
    const attrs = match[1];
    const dMatch = attrs.match(/android:pathData="([^"]+)"/);
    const fillMatch = attrs.match(/android:fillColor="([^"]+)"/);
    const strokeMatch = attrs.match(/android:strokeColor="([^"]+)"/);
    const strokeWidthMatch = attrs.match(/android:strokeWidth="([^"]+)"/);
    const fillAlphaMatch = attrs.match(/android:fillAlpha="([^"]+)"/);
    const fillTypeMatch = attrs.match(/android:fillType="([^"]+)"/);

    if (!dMatch) continue;
    let fill = fillMatch ? fillMatch[1] : 'none';
    if (fill.startsWith('#') && fill.length === 9) {
      // Convert #AARRGGBB -> rgba or #RRGGBBAA
      const aa = fill.slice(1, 3);
      const rrggbb = fill.slice(3);
      fill = `#${rrggbb}${aa}`;
    }

    const svgAttrs = [`d="${dMatch[1]}"`, `fill="${fill}"`];
    if (strokeMatch) svgAttrs.push(`stroke="${strokeMatch[1]}"`);
    if (strokeWidthMatch) svgAttrs.push(`stroke-width="${strokeWidthMatch[1]}"`);
    if (fillAlphaMatch) svgAttrs.push(`fill-opacity="${fillAlphaMatch[1]}"`);
    if (fillTypeMatch && fillTypeMatch[1].toLowerCase() === 'evenodd') {
      svgAttrs.push('fill-rule="evenodd"');
    }
    paths.push(`  <path ${svgAttrs.join(' ')} />`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${vh}" width="100%" height="100%">\n${paths.join('\n')}\n</svg>\n`;
}

if (fs.existsSync(drawableDir)) {
  // 1. Copy raster wallpapers & logos
  const rasterFiles = [
    { src: 'wallpaper_chocolate_silk.png', dest: path.join(wallpapersOutDir, 'wallpaper_chocolate_silk.png') },
    { src: 'wallpaper_summer_villa.jpg', dest: path.join(wallpapersOutDir, 'wallpaper_summer_villa.jpg') },
    { src: 'ic_tessera_browser_logo.png', dest: path.join(publicAssetsDir, 'ic_tessera_browser_logo.png') },
    { src: 'ic_tessera_header_logo.png', dest: path.join(publicAssetsDir, 'ic_tessera_header_logo.png') },
    { src: 'ic_developer_avatar.png', dest: path.join(publicAssetsDir, 'ic_developer_avatar.png') }
  ];

  for (const item of rasterFiles) {
    const srcPath = path.join(drawableDir, item.src);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, item.dest);
    }
  }

  // 2. Convert ic_brand_*.xml and ic_incognito.xml to SVG
  const files = fs.readdirSync(drawableDir);
  for (const file of files) {
    if ((file.startsWith('ic_brand_') || file === 'ic_incognito.xml') && file.endsWith('.xml')) {
      const xml = fs.readFileSync(path.join(drawableDir, file), 'utf-8');
      const svg = convertAndroidVectorToSvg(xml);
      const outName = file.replace(/^ic_brand_/, '').replace(/\.xml$/, '.svg');
      fs.writeFileSync(path.join(brandsOutDir, outName), svg, 'utf-8');
    }
  }
}

// 3. Build 256x256 PNG and valid Windows .ico for Electron Builder & BrowserWindow icon
const customWindowsSource = path.join(buildDir, 'icon-source.png');
const resizedPngPath = path.join(buildDir, 'icon.png');
const icoOutPath = path.join(buildDir, 'icon.ico');

if (fs.existsSync(customWindowsSource)) {
  console.log('[Tessera] Ícone customizado do Windows detectado em build/icon-source.png. Preservando ícone desktop!');
  fs.copyFileSync(customWindowsSource, resizedPngPath);
  fs.copyFileSync(customWindowsSource, path.join(publicAssetsDir, 'icon.png'));
} else {
  const sourceIconCandidates = [
    path.join(drawableDir, 'ic_tessera_browser_logo.png'),
    path.join(mipmapDir, 'ic_launcher.png')
  ];
  const sourceIcon = sourceIconCandidates.find((p) => fs.existsSync(p));

  if (sourceIcon && process.platform === 'win32') {
    try {
      const psScript = `
        Add-Type -AssemblyName System.Drawing
        $src = [System.Drawing.Image]::FromFile('${sourceIcon.replace(/'/g, "''")}')
        $bmp = New-Object System.Drawing.Bitmap(256, 256)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.Clear([System.Drawing.Color]::Transparent)
        $g.DrawImage($src, 0, 0, 256, 256)
        $bmp.Save('${resizedPngPath.replace(/'/g, "''")}', [System.Drawing.Imaging.ImageFormat]::Png)
        $g.Dispose()
        $bmp.Dispose()
        $src.Dispose()
      `;
      execFileSync('powershell.exe', ['-NoProfile', '-Command', psScript], { stdio: 'ignore' });
    } catch {
      fs.copyFileSync(sourceIcon, resizedPngPath);
    }
  } else if (sourceIcon) {
    fs.copyFileSync(sourceIcon, resizedPngPath);
  }

  if (fs.existsSync(resizedPngPath)) {
    // Wrap 256x256 PNG into valid Windows ICO container (ICONDIR + ICONDIRENTRY + PNG payload)
    const pngBuf = fs.readFileSync(resizedPngPath);
    const header = Buffer.alloc(22);
    header.writeUInt16LE(0, 0); // Reserved
    header.writeUInt16LE(1, 2); // Type 1 = ICO
    header.writeUInt16LE(1, 4); // Image count = 1
    header.writeUInt8(0, 6);    // Width 0 = 256px
    header.writeUInt8(0, 7);    // Height 0 = 256px
    header.writeUInt8(0, 8);    // Color palette
    header.writeUInt8(0, 9);    // Reserved
    header.writeUInt16LE(1, 10); // Color planes
    header.writeUInt16LE(32, 12); // Bits per pixel
    header.writeUInt32LE(pngBuf.length, 14); // Image size in bytes
    header.writeUInt32LE(22, 18); // Offset to PNG data
    fs.writeFileSync(icoOutPath, Buffer.concat([header, pngBuf]));
    fs.copyFileSync(resizedPngPath, path.join(publicAssetsDir, 'icon.png'));
  }
}

console.log('[Tessera] Assets sincronizados com sucesso da versão Android!');
