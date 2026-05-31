import { v2 as cloudinary } from 'cloudinary';

/**
 * Configure Cloudinary et valide les variables d'environnement.
 * Appelé uniquement au moment d'un upload (pas au démarrage du serveur),
 * afin de ne pas faire crasher l'API en CI où les vars ne sont pas définies.
 */
export function getCloudinary(): typeof cloudinary {
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;

  if (!cloud_name || !api_key || !api_secret) {
    throw new Error(
      'Variables Cloudinary manquantes : CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET',
    );
  }

  cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
  return cloudinary;
}
