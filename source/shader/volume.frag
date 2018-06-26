#version 150
//#extension GL_ARB_shading_language_420pack : require
#extension GL_ARB_explicit_attrib_location : require

#define TASK 10
#define ENABLE_OPACITY_CORRECTION 0
#define ENABLE_LIGHTNING 0
#define ENABLE_SHADOWING 0

in vec3 ray_entry_position;

layout(location = 0) out vec4 FragColor;

uniform mat4 Modelview;

uniform sampler3D volume_texture;
uniform sampler2D transfer_texture;


uniform vec3    camera_location;
uniform float   sampling_distance;
uniform float   sampling_distance_ref;
uniform float   iso_value;
uniform vec3    max_bounds;
uniform ivec3   volume_dimensions;

uniform vec3    light_position;
uniform vec3    light_ambient_color;
uniform vec3    light_diffuse_color;
uniform vec3    light_specular_color;
uniform float   light_ref_coef;

bool
inside_volume_bounds(const in vec3 sampling_position)
{
    return (   all(greaterThanEqual(sampling_position, vec3(0.0)))
            && all(lessThanEqual(sampling_position, max_bounds)));
}


float
get_sample_data(vec3 in_sampling_pos)
{
    vec3 obj_to_tex = vec3(1.0) / max_bounds;
    return texture(volume_texture, in_sampling_pos * obj_to_tex).r;

}

vec3 binary_search(vec3 first, vec3 second)
{
    float first_sample = get_sample_data(first);
    float second_sample = get_sample_data(second);
    float center_sample;

    vec3 center;

    // swap samples
    if (second_sample < first_sample) {
        center = first;
        first = second;
        second = center;
    }

    // subdivide between samples
    {
        center = first + (second-first)/2;
        first_sample = get_sample_data(first);
        second_sample = get_sample_data(second);
        center_sample = get_sample_data(center);

        // returns correct pixel (under a certain threshold to prevent endless)
        if ((center_sample < iso_value) || (center_sample > iso_value)) {
           return center;
        } else if (center_sample > iso_value) {
            second = center;
        } else {
            first = center;
        }
    } while (first_sample <= second_sample)

    return vec3(0.0,0.0,0.0);
    
}

vec3 get_gradient(vec3 position) {
    vec3 step = max_bounds/volume_dimensions;
    // Dx = ( f(x+1, y, z) - f(x-1, y, z) ) / 2 CENTRAL DIFFERENCE
    vec3 gradient = vec3((get_sample_data(vec3(position.x + step.x, position.yz)) - get_sample_data(vec3(position.x - step.x, position.yz))) / 2,
                         (get_sample_data(vec3(position.x, position.y + step.y, position.z)) - get_sample_data(vec3(position.x, position.y - step.y, position.z))) / 2,
                         (get_sample_data(vec3(position.xy, position.z + step.z)) - get_sample_data(vec3(position.xy, position.z - step.z))) / 2);

    return gradient;
}

vec3 back_to_front(vec3 position, vec4 color){    
    return color.a*color.rgb+(1-color.a)*position;
}
void main()
{
    /// One step trough the volume
    vec3 ray_increment      = normalize(ray_entry_position - camera_location) * sampling_distance;
    /// Position in Volume
    vec3 sampling_pos       = ray_entry_position + ray_increment; // test, increment just to be sure we are in the volume

    /// Init color of fragment
    vec4 dst = vec4(0.0, 0.0, 0.0, 0.0);

    /// check if we are inside volume
    bool inside_volume = inside_volume_bounds(sampling_pos);
    
    if (!inside_volume)
        discard;

#if TASK == 10
    vec4 max_val = vec4(0.0, 0.0, 0.0, 0.0);
    
    // the traversal loop,
    // termination when the sampling position is outside volume boundarys
    // another termination condition for early ray termination is added
    while (inside_volume) 
    {      
        // get sample
        float s = get_sample_data(sampling_pos);
                
        // apply the transfer functions to retrieve color and opacity
        vec4 color = texture(transfer_texture, vec2(s, s));
           
        // this is the example for maximum intensity projection
        max_val.r = max(color.r, max_val.r);
        max_val.g = max(color.g, max_val.g);
        max_val.b = max(color.b, max_val.b);
        max_val.a = max(color.a, max_val.a);
        
        // increment the ray sampling position
        sampling_pos  += ray_increment;

        // update the loop termination condition
        inside_volume  = inside_volume_bounds(sampling_pos);
    }

    dst = max_val;
#endif 
    
#if TASK == 11

    vec4 max_val = vec4(0.0, 0.0, 0.0, 0.0);
    vec4 min_val = vec4(0.0, 0.0, 0.0, 0.0);
    vec4 avg_val = vec4(0.0, 0.0, 0.0, 0.0);
    vec4 sum_val = vec4(0.0, 0.0, 0.0, 0.0);
    int num_samples = 0;

    // the traversal loop,
    // termination when the sampling position is outside volume boundarys
    // another termination condition for early ray termination is added
    while (inside_volume)
    {      
        // get sample
        float s = get_sample_data(sampling_pos);

        // apply the transfer functions to retrieve color and opacity
        vec4 color = texture(transfer_texture, vec2(s, s));
        
        sum_val.r = sum_val.r+color.r;
        sum_val.g = sum_val.g+color.g;
        sum_val.b = sum_val.b+color.b;
        sum_val.a = sum_val.a+ color.a;
        num_samples++;


        // increment the ray sampling position
        sampling_pos  += ray_increment;

        // update the loop termination condition
        inside_volume  = inside_volume_bounds(sampling_pos);
    }
    
    avg_val.r = sum_val.r / num_samples;
    avg_val.g = sum_val.g / num_samples;
    avg_val.b = sum_val.b / num_samples;
    avg_val.a = sum_val.a / num_samples;
    dst = avg_val;
#endif
    
#if TASK == 12 || TASK == 13
    dst = vec4(0.0,0.0,0.0,0.0);
    float s = 0;
    // the traversal loop,
    // termination when the sampling position is outside volume boundarys
    // another termination condition for early ray termination is added
    while (inside_volume)
    {
        // get sample
        s = get_sample_data(sampling_pos);
        if(s > iso_value){
            dst = texture(transfer_texture, vec2(s,s));

        // increment the ray sampling position
        sampling_pos += ray_increment;

#if TASK == 13 // Binary Search
        sampling_pos = binary_search(sampling_pos - ray_increment, sampling_pos);
        s = get_sample_data(sampling_pos);
        if (sampling_pos != vec3(0.0,0.0,0.0)) {
            dst = texture(transfer_texture, vec2(s,s));
        }


#endif
#if ENABLE_LIGHTNING == 1 // Add Shading
        vec3 normal = normalize(get_gradient(sampling_pos))*-1;
        vec3 light = normalize(light_position - sampling_pos);
        float lambertian = max(dot(normal,light),0);
        float specular = 0.0;
        if(lambertian > 0.0) {
            float specularAngle = max(dot(light, normal), 0.0);
            specular = pow(specularAngle, light_ref_coef);
        }

        dst = vec4(light_ambient_color + light_diffuse_color.rgb * lambertian + light_specular_color.rgb * specular, 1);

#if ENABLE_SHADOWING == 1 // Add Shadows
        vec3 light_step = light * sampling_distance;
        vec3 sh_sample = sampling_pos;
        while (inside_volume) {
            sh_sample += light_step;

            s = get_sample_data(sh_sample);
            float r = get_sample_data(sh_sample + light_step);
            if((s > iso_value && r < iso_value) || (s < iso_value && r > iso_value)){
                dst = vec4(0.0,0.0,0.0,1.0);
                break;
            }
            r = s;
            inside_volume = inside_volume_bounds(sh_sample);
        }
#endif
#endif
        break;
    }
        sampling_pos += ray_increment;
        // update the loop termination condition
        inside_volume = inside_volume_bounds(sampling_pos);
    }

#endif 

#if TASK == 31

    // the traversal loop,
    // termination when the sampling position is outside volume boundarys
    // another termination condition for early ray termination is added
    while (inside_volume)
    {
       
#if ENABLE_OPACITY_CORRECTION == 1 // Opacity Correction
        IMPLEMENT;
#else
        
#endif
        float s;
        s = get_sample_data(sampling_pos);

        vec4 color = texture(transfer_texture, vec2(s, s));

        sampling_pos = back_to_front(sampling_pos, color);
        // get sample
        s = get_sample_data(sampling_pos);
            
        dst = texture(transfer_texture, vec2(s,s));

        

#if ENABLE_LIGHTNING == 1 // Add Shading
        IMPLEMENT;
#endif
        // increment the ray sampling position
        sampling_pos += ray_increment;
        // update the loop termination condition
        inside_volume = inside_volume_bounds(sampling_pos);
    }
#endif 

    // return the calculated color value
    FragColor = dst;
}

