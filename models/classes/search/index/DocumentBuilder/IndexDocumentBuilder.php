<?php
/**
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; under version 2
 * of the License (non-upgradable).
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 *
 * Copyright (c) 2020 (original work) Open Assessment Technologies SA;
 */

declare(strict_types=1);

namespace oat\tao\model\search\index\DocumentBuilder;

use oat\generis\model\OntologyAwareTrait;
use oat\generis\model\OntologyRdfs;
use oat\generis\model\WidgetRdf;
use oat\tao\model\search\index\IndexDocument;
use ArrayIterator;
use core_kernel_classes_Literal as Literal;
use core_kernel_classes_Resource;
use Iterator;
use oat\tao\model\search\index\IndexProperty;
use oat\tao\model\search\index\OntologyIndex;
use oat\tao\model\search\SearchTokenGenerator;
use oat\tao\model\TaoOntology;
use oat\tao\model\WidgetDefinitions;

class IndexDocumentBuilder implements IndexDocumentBuilderInterface
{
    use OntologyAwareTrait;
    
    /** @var array */
    private $map = [];
    
    public const ALLOWED_DYNAMIC_TYPES = [
        WidgetDefinitions::PROPERTY_TEXTBOX,
        WidgetDefinitions::PROPERTY_TEXTAREA,
        WidgetDefinitions::PROPERTY_HTMLAREA,
        WidgetDefinitions::PROPERTY_CHECKBOX,
        WidgetDefinitions::PROPERTY_COMBOBOX,
        WidgetDefinitions::PROPERTY_RADIOBOX,
    ];
    
    /**
     * {@inheritdoc}
     */
    public function createDocumentFromResource(\core_kernel_classes_Resource $resource): IndexDocument
    {
        $tokenizationInfo = $this->getTokenizedResourceBody($resource);
        
        $body = $tokenizationInfo['body'];
        $indexProperties = $tokenizationInfo['indexProperties'];
        
        $body['type'] = $this->getTypesForResource($resource);
        $dynamicProperties = $this->getDynamicProperties($resource->getTypes(), $resource);
        
        return new IndexDocument(
            $resource->getUri(),
            $body,
            $indexProperties,
            $dynamicProperties
        );
    }
    
    /**
     * {@inheritdoc}
     */
    public function createDocumentFromArray(array $resource = []): IndexDocument
    {
        if (!isset($resource['id'])) {
            throw new \common_exception_MissingParameter('id');
        }
    
        if (!isset($resource['body'])) {
            throw new \common_exception_MissingParameter('body');
        }
    
        $body = $resource['body'];
        $indexProperties = [];
    
        if (isset($resource['indexProperties'])) {
            $indexProperties = $resource['indexProperties'];
        }
    
        $document = new IndexDocument(
            $resource['id'],
            $body,
            $indexProperties
        );
    
        return $document;
    }
    
    /**
     * @return string[]
     * @throws \common_exception_Error
     */
    protected function getTypesForResource(\core_kernel_classes_Resource $resource): array
    {
        $toDo = [];
        foreach ($resource->getTypes() as $class) {
            $toDo[] = $class->getUri();
        }
        
        $done = [OntologyRdfs::RDFS_RESOURCE, TaoOntology::CLASS_URI_OBJECT];
        $toDo = array_diff($toDo, $done);
        
        $classes = [];
        while (!empty($toDo)) {
            $class = new \core_kernel_classes_Class(array_pop($toDo));
            $classes[] = $class->getUri();
            foreach ($class->getParentClasses() as $parent) {
                if (!in_array($parent->getUri(), $done)) {
                    $toDo[] = $parent->getUri();
                }
            }
            $done[] = $class->getUri();
        }
        
        return $classes;
    }
    
    /**
     * Get the array of properties to be indexed
     *
     * @param core_kernel_classes_Resource $resource
     * @return array
     * @throws \common_Exception
     * @throws \common_exception_InconsistentData
     */
    protected function getTokenizedResourceBody(core_kernel_classes_Resource $resource): array
    {
        $tokenGenerator = new SearchTokenGenerator();
        
        $body = [];
        $indexProperties = [];
        
        foreach ($tokenGenerator->generateTokens($resource) as $data) {
            /** @var OntologyIndex $index */
            list($index, $strings) = $data;
            $body[$index->getIdentifier()] = $strings;
            $indexProperties[$index->getIdentifier()] = $this->getIndexProperties($index);
        }
        
        $result = [
            'body' => $body,
            'indexProperties' => $indexProperties
        ];
        
        return $result;
    }
    
    /**
     * Get the list of index properties for indexation
     * @param OntologyIndex $index
     * @return IndexProperty
     * @throws \common_Exception
     */
    protected function getIndexProperties(OntologyIndex $index): IndexProperty
    {
        if (!isset($this->map[$index->getIdentifier()])) {
            $indexProperty = new IndexProperty(
                $index->getIdentifier(),
                $index->isFuzzyMatching(),
                $index->isDefaultSearchable()
            );
            $this->map[$index->getIdentifier()] = $indexProperty;
        }
        
        return $this->map[$index->getIdentifier()];
    }
    
    /**
     * Get the dynamic properties for indexation
     * @param array $classes
     * @param core_kernel_classes_Resource $resource
     * @return Iterator
     * @throws \core_kernel_persistence_Exception
     */
    protected function getDynamicProperties(array $classes, core_kernel_classes_Resource $resource): Iterator
    {
        $customProperties = [];
        
        foreach ($classes as $class) {
            $properties = \tao_helpers_form_GenerisFormFactory::getClassProperties(
                $this->getClass($class)
            );
            
            foreach ($properties as $property) {
                /** @var core_kernel_classes_Resource $propertyType |null */
                $propertyType = $property->getOnePropertyValue(
                    $this->getProperty(
                        WidgetRdf::PROPERTY_WIDGET
                    )
                );
                
                if (null === $propertyType) {
                    continue;
                }
                
                $propertyTypeUri = $propertyType->getUri();
                
                if (!in_array($propertyTypeUri, self::ALLOWED_DYNAMIC_TYPES)) {
                    continue;
                }
                
                $propertyTypeArray = explode('#', $propertyTypeUri, 2);
                $propertyTypeId = end($propertyTypeArray);
                $customPropertyLabel = $property->getLabel();
                
                if (false === $propertyTypeId) {
                    continue;
                }
                
                $fieldName = $propertyTypeId . '_' . \tao_helpers_Slug::create($customPropertyLabel);
                $propertyValue = $resource->getOnePropertyValue($property);
                
                if (null === $propertyValue) {
                    continue;
                }
                
                if ($propertyValue instanceof Literal) {
                    $customProperties[$fieldName][] = (string)$propertyValue;
                    $customProperties[$fieldName] = array_unique($customProperties[$fieldName]);
                    continue;
                }
                
                $customPropertiesValues = $resource->getPropertyValues($property);
                $customProperties[$fieldName] = array_map(
                    function (string $propertyValue): string {
                        return $this->getProperty($propertyValue)->getLabel();
                    },
                    $customPropertiesValues
                );
            }
        }
        
        return new ArrayIterator($customProperties);
    }
}