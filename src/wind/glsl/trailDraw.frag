uniform sampler2D segmentsColorTexture;
uniform sampler2D segmentsDepthTexture;

uniform sampler2D currentTrailsColor;

uniform float fadeOpacity;

// reprojection of the trails from the previous camera to the current one,
// so the trails (stored in screen space) stay on the globe while the camera moves
// the matrices only contain the camera rotation, positions are relative to the camera for float precision
uniform mat4 inverseViewProjection; // current frame, NDC -> direction from the camera
uniform mat4 previousViewProjection; // previous frame, camera-relative position -> clip space
uniform vec3 cameraPositionScaled; // current camera position divided by the ellipsoid radii
uniform float cameraEllipsoidC; // dot(cameraPositionScaled, cameraPositionScaled) - 1, computed in double precision
uniform vec3 cameraDelta; // current camera position - previous camera position
uniform vec3 ellipsoidRadii; // WGS84 radii + particle height

in vec2 textureCoordinate;

// returns the texel of the previous trails that shows the same point on the globe, or (-1, -1)
ivec2 reprojectedTexel(ivec2 size) {
    vec2 ndc = textureCoordinate * 2.0 - 1.0;
    vec4 farPoint = inverseViewProjection * vec4(ndc, 0.0, 1.0);
    vec3 direction = normalize(farPoint.xyz / farPoint.w);

    // intersect the view ray with the ellipsoid (scaled to a unit sphere)
    vec3 d = direction / ellipsoidRadii;
    float a = dot(d, d);
    float b = 2.0 * dot(cameraPositionScaled, d);
    float discriminant = b * b - 4.0 * a * cameraEllipsoidC;
    if (discriminant < 0.0) {
        return ivec2(-1);
    }
    float t = (-b - sqrt(discriminant)) / (2.0 * a);
    if (t < 0.0) {
        return ivec2(-1);
    }

    // the point must face the previous camera, otherwise it was hidden behind the globe
    vec3 relativeToPrevious = t * direction + cameraDelta;
    vec3 surfaceNormal = (cameraPositionScaled + t * d) / ellipsoidRadii;
    if (dot(surfaceNormal, relativeToPrevious) >= 0.0) {
        return ivec2(-1);
    }

    vec4 previousClip = previousViewProjection * vec4(relativeToPrevious, 1.0);
    if (previousClip.w <= 0.0) {
        return ivec2(-1);
    }
    vec2 previousCoordinate = (previousClip.xy / previousClip.w) * 0.5 + 0.5;
    if (any(lessThan(previousCoordinate, vec2(0.0))) || any(greaterThanEqual(previousCoordinate, vec2(1.0)))) {
        return ivec2(-1);
    }
    // nearest texel, so the trails do not get blurred
    return ivec2(previousCoordinate * vec2(size));
}

void main() {
    vec4 pointsColor = texture(segmentsColorTexture, textureCoordinate);
    float pointsDepth = texture(segmentsDepthTexture, textureCoordinate).r;
    float globeDepth = czm_unpackDepth(texture(czm_globeDepthTexture, textureCoordinate));

    vec4 trailsColor = vec4(0.0);
    ivec2 texel = reprojectedTexel(textureSize(currentTrailsColor, 0));
    if (texel.x >= 0) {
        trailsColor = texelFetch(currentTrailsColor, texel, 0);
    }
    trailsColor = floor(fadeOpacity * 255.0 * trailsColor) / 255.0; // make sure the trailsColor will be strictly decreased

    out_FragColor = vec4(0.0);
    if (pointsDepth < globeDepth) {
        out_FragColor = out_FragColor + pointsColor;
    }
    // the reprojection already removed trails behind the globe, so they are always in front
    // (the depth of the previous frame would be wrong after the camera moved)
    out_FragColor = out_FragColor + trailsColor;
    gl_FragDepth = (any(greaterThan(trailsColor, vec4(0.0)))) ? 0.0 : pointsDepth;
}
