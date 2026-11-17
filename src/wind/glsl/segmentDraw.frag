in float windNorm;

// blue (calm) -> cyan -> green -> yellow -> red (strong wind)
vec3 windColor(float t) {
    const vec3 c0 = vec3(0.20, 0.40, 1.00);
    const vec3 c1 = vec3(0.00, 0.85, 1.00);
    const vec3 c2 = vec3(0.20, 1.00, 0.30);
    const vec3 c3 = vec3(1.00, 0.90, 0.10);
    const vec3 c4 = vec3(1.00, 0.20, 0.10);

    float x = clamp(t, 0.0, 1.0) * 4.0;
    if (x < 1.0) return mix(c0, c1, x);
    if (x < 2.0) return mix(c1, c2, x - 1.0);
    if (x < 3.0) return mix(c2, c3, x - 2.0);
    return mix(c3, c4, x - 3.0);
}

void main() {
    out_FragColor = vec4(windColor(windNorm), 1.0);
}
